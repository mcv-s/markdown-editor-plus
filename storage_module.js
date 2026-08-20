
/*
 * =========================================================
 * storage_module.js
 *
 * Centralized storage and file management.
 *
 * This module contains no editor/UI-specific code and
 * makes no assumptions about any particular file type.
 *
 * Handles:
 *
 *   - File System Access API
 *   - File selection
 *   - Save locations
 *   - Reading files
 *   - Writing files
 *   - File downloads
 *   - Last opened file
 *   - IndexedDB
 *   - File permissions
 *   - localStorage
 *   - Remote files
 *   - GitHub files
 *   - Local file paths
 *
 * Filetype-specific behavior is supplied by the program
 * using this module.
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

const DB_NAME =
    "storage-module";

const DB_VERSION =
    1;

const STORE_NAME =
    "files";


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

async function saveLastOpenedFile(
    handle,
    key = "currentFile"
) {

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
                key
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


async function getLastOpenedFile(
    key = "currentFile"
) {

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
                    key
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


async function clearLastOpenedFile(
    key = "currentFile"
) {

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
                key
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

async function selectFile(
    config = {}
) {

    if (supportsFileSystemAccess) {

        try {

            const [handle] =
                await window.showOpenFilePicker({

                    multiple:
                        config.multiple ??
                        false,

                    types:
                        config.types ??
                        [],

                    excludeAcceptAllOption:
                        config.excludeAcceptAllOption ??
                        false
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


    /*
     * Browser fallback.
     */

    const input =
        document.createElement(
            "input"
        );


    input.type =
        "file";


    input.multiple =
        config.multiple ??
        false;


    if (
        config.accept
    ) {

        input.accept =
            config.accept;
    }


    return new Promise(resolve => {

        input.addEventListener(
            "change",
            () => {

                if (
                    config.multiple
                ) {

                    resolve(
                        Array.from(
                            input.files || []
                        )
                    );

                    return;
                }


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
    config = {}
) {

    if (
        !supportsFileSystemAccess
    ) {

        return null;
    }


    try {

        return await window.showSaveFilePicker({

            suggestedName:
                config.suggestedName ??
                "document",

            types:
                config.types ??
                [],

            excludeAcceptAllOption:
                config.excludeAcceptAllOption ??
                false
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

async function readFile(
    source,
    config = {}
) {

    const mode =
        config.readMode ??
        "text";


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


        return readFileContents(
            file,
            mode
        );
    }


    /*
     * File / Blob
     */

    if (
        source &&
        typeof source.text ===
        "function"
    ) {

        return readFileContents(
            source,
            mode
        );
    }


    throw new Error(
        "Invalid file source."
    );
}


/* =========================================================
   Read File Contents
   ========================================================= */

async function readFileContents(
    file,
    mode
) {

    switch (mode) {

        case "text":

            return await file.text();


        case "arrayBuffer":

            return await file.arrayBuffer();


        case "blob":

            return file;


        case "file":

            return file;


        default:

            throw new Error(
                `Unsupported read mode: ${mode}`
            );
    }
}


/* =========================================================
   Get File Name
   ========================================================= */

function getFileName(
    source,
    config = {}
) {

    if (
        source &&
        typeof source.name ===
        "string"
    ) {

        return source.name;
    }


    return (
        config.defaultName ??
        "document"
    );
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
    contents,
    config = {}
) {

    await writeFile(
        handle,
        contents
    );


    /*
     * A successfully saved file is also
     * the last opened file.
     */

    if (
        config.rememberFile !== false
    ) {

        await saveLastOpenedFile(
            handle,

            config.lastOpenedFileKey ??
            "currentFile"
        );
    }
}


/* =========================================================
   File Permissions
   ========================================================= */

async function requestFilePermission(
    handle,
    config = {}
) {

    if (
        !handle ||
        typeof handle.queryPermission !==
        "function"
    ) {

        return false;
    }


    const mode =
        config.permissionMode ??
        "readwrite";


    let permission =
        await handle.queryPermission({
            mode
        });


    if (
        permission !==
        "granted"
    ) {

        permission =
            await handle.requestPermission({
                mode
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
    name,
    config = {}
) {

    const downloadName =
        name ||
        config.defaultName ||
        "download";


    const blob =
        contents instanceof Blob
            ? contents
            : new Blob(
                [contents],
                {
                    type:
                        config.mimeType ??
                        "application/octet-stream"
                }
            );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        downloadName;


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

async function loadRemoteFile(
    url,
    config = {}
) {

    const response =
        await fetch(
            url,
            config.fetchOptions ?? {}
        );


    if (!response.ok) {

        throw new Error(
            `HTTP ${response.status}`
        );
    }


    const parsedUrl =
        new URL(url);


    const name =
        parsedUrl.pathname
            .split("/")
            .pop() ||
        config.defaultName ||
        "download";


    const contents =
        await readRemoteContents(
            response,
            config.readMode ??
            "text"
        );


    return {

        contents,

        name,

        url:
            parsedUrl.href
    };
}


/* =========================================================
   Read Remote Contents
   ========================================================= */

async function readRemoteContents(
    response,
    mode
) {

    switch (mode) {

        case "text":

            return await response.text();


        case "arrayBuffer":

            return await response.arrayBuffer();


        case "blob":

            return await response.blob();


        case "response":

            return response;


        default:

            throw new Error(
                `Unsupported read mode: ${mode}`
            );
    }
}


/* =========================================================
   GitHub Blob → Raw URL
   ========================================================= */

function githubBlobToRawUrl(
    url
) {

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
        parts.indexOf(
            "blob"
        );


    const commit =
        parts[
            blobIndex + 1
        ];


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

async function openFileFromPath(
    filePath,
    config = {}
) {

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
        filePath.startsWith(
            "\\\\"
        );


    if (
        isWindowsPath ||
        isUNCPath
    ) {

        return await openLocalPath(
            filePath,
            config
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
                rawUrl,
                config
            );


        return {

            type:
                "remote",

            contents:
                remote.contents,

            name:
                remote.name,

            handle:
                null,

            url:
                remote.url
        };
    }


    /*
     * HTTP / HTTPS
     */

    if (
        url.protocol !==
            "http:" &&
        url.protocol !==
            "https:"
    ) {

        throw new Error(
            "Unsupported file path."
        );
    }


    const remote =
        await loadRemoteFile(
            url.href,
            config
        );


    return {

        type:
            "remote",

        contents:
            remote.contents,

        name:
            remote.name,

        handle:
            null,

        url:
            remote.url
    };
}


/* =========================================================
   Open Local Path
   ========================================================= */

async function openLocalPath(
    path,
    config = {}
) {

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
        await selectFile(
            config
        );


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
            config.verifyName !== false &&
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
                handle,
                config
            );


        if (
            config.rememberFile !== false
        ) {

            await saveLastOpenedFile(
                handle,

                config.lastOpenedFileKey ??
                "currentFile"
            );
        }


        return {

            type:
                "local",

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
            handle,
            config
        );


    return {

        type:
            "local",

        contents,

        name:
            getFileName(
                handle,
                config
            ),

        handle:
            null
    };
}


/* =========================================================
   localStorage
   ========================================================= */

function getStorage(
    key
) {

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


function removeStorage(
    key
) {

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
    readFileContents,
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

