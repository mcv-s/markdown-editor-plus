


/*
 * =========================================================
 * storage_module.js
 *
 * Centralized storage and file management.
 *
 * This module contains no editor/UI-specific code.
 *
 * Handles:
 * - File System Access API
 * - File selection
 * - Save locations
 * - Reading files
 * - Writing files
 * - File downloads
 * - Last opened file
 * - IndexedDB
 * - File permissions
 * - localStorage
 * - Remote files
 * - GitHub files
 * - Local file paths
 * =========================================================
 */


/* =========================================================
   File System Access API
   ========================================================= */

const supportsFileSystemAccess =
    "showOpenFilePicker" in window &&
    "showSaveFilePicker" in window;



/* =========================================================
   IndexedDB Configuration
   ========================================================= */

const DB_NAME = "storage-module";

const DB_VERSION = 1;

const STORE_NAME = "files";

const LAST_OPENED_FILE_KEY = "currentFile";


/* =========================================================
   IndexedDB
   ========================================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );


        request.onupgradeneeded = () => {

            const db =
                request.result;


            if (
                !db.objectStoreNames.contains(
                    STORE_NAME
                )
            ) {

                db.createObjectStore(
                    STORE_NAME
                );
            }
        };


        request.onsuccess = () => {

            resolve(
                request.result
            );
        };


        request.onerror = () => {

            reject(
                request.error
            );
        };
    });
}


/* =========================================================
   Last Opened File
   ========================================================= */

async function saveLastOpenedFile(handle) {

    if (!handle) {
        return;
    }


    const db =
        await openDatabase();


    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                STORE_NAME,
                "readwrite"
            );


        transaction
            .objectStore(STORE_NAME)
            .put(
                handle,
                LAST_OPENED_FILE_KEY
            );


        transaction.oncomplete =
            resolve;


        transaction.onerror = () => {

            reject(
                transaction.error
            );
        };
    });
}


async function getLastOpenedFile() {

    const db =
        await openDatabase();


    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                STORE_NAME,
                "readonly"
            );


        const request =
            transaction
                .objectStore(STORE_NAME)
                .get(
                    LAST_OPENED_FILE_KEY
                );


        request.onsuccess = () => {

            resolve(
                request.result || null
            );
        };


        request.onerror = () => {

            reject(
                request.error
            );
        };
    });
}


async function clearLastOpenedFile() {

    const db =
        await openDatabase();


    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                STORE_NAME,
                "readwrite"
            );


        transaction
            .objectStore(STORE_NAME)
            .delete(
                LAST_OPENED_FILE_KEY
            );


        transaction.oncomplete =
            resolve;


        transaction.onerror = () => {

            reject(
                transaction.error
            );
        };
    });
}


/* =========================================================
   File Picker
   ========================================================= */

async function selectFile(options = {}) {

    if (supportsFileSystemAccess) {

        try {

            const [handle] =
                await window.showOpenFilePicker({
                    multiple:
                        options.multiple ?? false,

                    types:
                        options.types ?? []
                });

            return handle;

        } catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {
                return null;
            }

            throw error;
        }
    }


    const input =
        document.createElement("input");

    input.type = "file";

    if (options.accept) {
        input.accept =
            options.accept;
    }

    return new Promise(resolve => {

        input.addEventListener(
            "change",
            () => {

                const file =
                    input.files?.[0];

                resolve(
                    file || null
                );
            }
        );

        input.click();
    });
}


/* =========================================================
   Save Location Picker
   ========================================================= */

async function selectSaveLocation(
    suggestedName = "document",
    options = {}
) {

    if (!supportsFileSystemAccess) {
        return null;
    }

    try {

        return await window.showSaveFilePicker({

            suggestedName,

            types:
                options.types ?? []

        });

    } catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {
            return null;
        }

        throw error;
    }
}


/* =========================================================
   Read File
   ========================================================= */

async function readFile(source) {

    /*
     * FileSystemFileHandle
     */

    if (
        source &&
        typeof source.getFile ===
        "function"
    ) {

        const file =
            await source.getFile();


        return await file.text();
    }


    /*
     * File object
     */

    if (
        source &&
        typeof source.text ===
        "function"
    ) {

        return await source.text();
    }


    throw new Error(
        "Invalid file source."
    );
}


/* =========================================================
   Get File Name
   ========================================================= */

function getFileName(source) {

    if (
        source &&
        typeof source.name ===
        "string"
    ) {

        return source.name;
    }


    return "document.md";
}


/* =========================================================
   Write File
   ========================================================= */

async function writeFile(
    handle,
    contents
) {

    if (
        !handle ||
        typeof handle.createWritable !==
        "function"
    ) {

        throw new Error(
            "File handle is not writable."
        );
    }


    const writable =
        await handle.createWritable();


    try {

        await writable.write(
            contents
        );

    } finally {

        await writable.close();
    }
}


/* =========================================================
   Save Existing File
   ========================================================= */

async function saveFile(
    handle,
    contents
) {

    await writeFile(
        handle,
        contents
    );


    /*
     * A successfully saved file is also
     * the last opened file.
     */

    await saveLastOpenedFile(
        handle
    );
}


/* =========================================================
   File Permissions
   ========================================================= */

async function requestFilePermission(handle) {

    if (
        !handle ||
        typeof handle.queryPermission !==
        "function"
    ) {

        return false;
    }


    let permission =
        await handle.queryPermission({
            mode: "readwrite"
        });


    if (
        permission !==
        "granted"
    ) {

        permission =
            await handle.requestPermission({
                mode: "readwrite"
            });
    }


    return (
        permission ===
        "granted"
    );
}


/* =========================================================
   Download File
   ========================================================= */

function downloadFile(
    contents,
    name = "document.md"
) {

    if (!name) {
        name = "document.md";
    }


    if (
        !name
            .toLowerCase()
            .endsWith(".md")
    ) {

        name += ".md";
    }


    const blob =
        new Blob(
            [contents],
            {
                type:
                    "text/markdown;charset=utf-8"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement("a");


    link.href = url;

    link.download = name;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );
}


/* =========================================================
   Remote Files
   ========================================================= */

async function loadRemoteFile(url) {

    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `HTTP ${response.status}`
        );
    }


    const contents =
        await response.text();


    const parsedUrl =
        new URL(url);


    const name =
        parsedUrl.pathname
            .split("/")
            .pop() ||
        "document.md";


    return {
        contents,
        name,
        url: parsedUrl.href
    };
}


/* =========================================================
   GitHub Blob → Raw URL
   ========================================================= */

function githubBlobToRawUrl(url) {

    const parsedUrl =
        new URL(url);


    if (
        parsedUrl.hostname !==
        "github.com"
    ) {

        return null;
    }


    if (
        !parsedUrl.pathname.includes(
            "/blob/"
        )
    ) {

        return null;
    }


    const parts =
        parsedUrl.pathname
            .split("/");


    const owner =
        parts[1];

    const repo =
        parts[2];

    const blobIndex =
        parts.indexOf("blob");


    const commit =
        parts[blobIndex + 1];


    const fileParts =
        parts.slice(
            blobIndex + 2
        );


    if (
        !owner ||
        !repo ||
        !commit ||
        !fileParts.length
    ) {

        return null;
    }


    return (
        "https://raw.githubusercontent.com/" +
        `${owner}/${repo}/` +
        `${commit}/` +
        `${fileParts.join("/")}`
    );
}


/* =========================================================
   Open File From Path
   ========================================================= */

async function openFileFromPath(filePath) {

    /*
     * Windows path
     */

    const isWindowsPath =
        /^[a-zA-Z]:[\\/]/.test(
            filePath
        );


    /*
     * UNC path
     */

    const isUNCPath =
        filePath.startsWith("\\\\");


    if (
        isWindowsPath ||
        isUNCPath
    ) {

        return await openLocalPath(
            filePath
        );
    }


    /*
     * Web URL
     */

    const url =
        new URL(
            filePath,
            window.location.href
        );


    /*
     * GitHub blob
     */

    const rawUrl =
        githubBlobToRawUrl(
            url.href
        );


    if (rawUrl) {

        const remote =
            await loadRemoteFile(
                rawUrl
            );


        return {
            type: "remote",
            contents:
                remote.contents,
            name:
                remote.name,
            handle: null,
            url:
                remote.url
        };
    }


    /*
     * HTTP / HTTPS
     */

    if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
    ) {

        throw new Error(
            "Unsupported file path."
        );
    }


    const remote =
        await loadRemoteFile(
            url.href
        );


    return {
        type: "remote",
        contents:
            remote.contents,
        name:
            remote.name,
        handle: null,
        url:
            remote.url
    };
}


/* =========================================================
   Open Local Path
   ========================================================= */

async function openLocalPath(path) {

    const normalizedPath =
        path.replace(
            /\\/g,
            "/"
        );


    const requestedName =
        decodeURIComponent(
            normalizedPath
                .split("/")
                .pop()
        );


    const handle =
        await selectFile();


    if (!handle) {
        return null;
    }


    /*
     * File System Access API
     */

    if (
        typeof handle.getFile ===
        "function"
    ) {

        if (
            handle.name !==
            requestedName
        ) {

            throw new Error(
                `Selected "${handle.name}" ` +
                `instead of "${requestedName}".`
            );
        }


        const contents =
            await readFile(
                handle
            );


        await saveLastOpenedFile(
            handle
        );


        return {
            type: "local",
            contents,
            name:
                handle.name,
            handle
        };
    }


    /*
     * Fallback File object
     */

    const contents =
        await readFile(
            handle
        );


    return {
        type: "local",
        contents,
        name:
            handle.name,
        handle: null
    };
}


/* =========================================================
   localStorage
   ========================================================= */

function getStorage(key) {

    return localStorage.getItem(
        key
    );
}


function setStorage(
    key,
    value
) {

    localStorage.setItem(
        key,
        value
    );
}


function removeStorage(key) {

    localStorage.removeItem(
        key
    );
}


/* =========================================================
   Public API
   ========================================================= */

window.StorageModule = {

    /*
     * Capabilities
     */

    supportsFileSystemAccess,


    /*
     * File picker
     */

    selectFile,
    selectSaveLocation,


    /*
     * File operations
     */

    readFile,
    writeFile,
    saveFile,
    getFileName,
    downloadFile,


    /*
     * Last opened file
     */

    saveLastOpenedFile,
    getLastOpenedFile,
    clearLastOpenedFile,


    /*
     * Permissions
     */

    requestFilePermission,


    /*
     * Remote/local paths
     */

    loadRemoteFile,
    githubBlobToRawUrl,
    openFileFromPath,
    openLocalPath,


    /*
     * localStorage
     */

    getStorage,
    setStorage,
    removeStorage

};

