let currentFileHandle = null;
let isUpdating = false;
let isDirty = false;

const editor = document.getElementById("editor");
const openFileButton = document.getElementById("openFile");
const saveFileButton = document.getElementById("saveFile");
const saveAsFileButton = document.getElementById("saveAsFile");

const fileName = document.getElementById("fileName");
const status = document.getElementById("status");
const wordCount = document.getElementById("wordCount");
const preview = document.getElementById("preview");

const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-"
});


/* -----------------------------
   File Handle Storage
----------------------------- */

const DB_NAME = "markdown-editor";
const DB_VERSION = 1;
const STORE_NAME = "files";
const HANDLE_KEY = "currentFile";


function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}


async function saveFileHandle(handle) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction =
            db.transaction(STORE_NAME, "readwrite");

        transaction.objectStore(STORE_NAME)
            .put(handle, HANDLE_KEY);

        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
}


async function getSavedFileHandle() {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction =
            db.transaction(STORE_NAME, "readonly");

        const request =
            transaction.objectStore(STORE_NAME)
                .get(HANDLE_KEY);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}


/* -----------------------------
   Open File
----------------------------- */

openFileButton.addEventListener("click", async () => {
    try {
        const [handle] =
            await window.showOpenFilePicker({
                multiple: false,

                types: [
                    {
                        description: "Markdown files",

                        accept: {
                            "text/markdown": [
                                ".md",
                                ".markdown"
                            ]
                        }
                    }
                ]
            });

        await loadFile(handle);

    } catch (error) {
        if (error.name !== "AbortError") {
            console.error(error);
            status.textContent =
                "Failed to open file";
        }
    }
});


async function loadFile(handle) {
    currentFileHandle = handle;

    const file = await handle.getFile();
    const contents = await file.text();

    editor.value = contents;

    fileName.textContent = file.name;

    saveFileButton.disabled = true;
    saveAsFileButton.disabled = false;

    await saveFileHandle(handle);

    setDirty(false);

    status.textContent = "Opened";

    updateEditor();
}


/* -----------------------------
   Restore Previous File
----------------------------- */

async function restorePreviousFile() {
    try {
        const handle = await getSavedFileHandle();

        if (!handle) {
            return;
        }

        const permission = await handle.queryPermission({
            mode: "readwrite"
        });

        if (permission === "granted") {
            await loadFile(handle);
            return;
        }

        fileName.textContent = handle.name;
        status.textContent = "Previous file available";

        /*
         * We can't silently request filesystem permission
         * during page startup. The user must interact with
         * the page first.
         */
        openFileButton.textContent = "Restore File";

        const restoreHandler = async () => {
            try {
                const newPermission =
                    await handle.requestPermission({
                        mode: "readwrite"
                    });

                if (newPermission === "granted") {
                    await loadFile(handle);

                    openFileButton.textContent = "Open";
                    openFileButton.removeEventListener(
                        "click",
                        restoreHandler
                    );
                }
            } catch (error) {
                console.error(error);
            }
        };

        openFileButton.addEventListener(
            "click",
            restoreHandler
        );

    } catch (error) {
        console.error(
            "Could not restore previous file:",
            error
        );
    }
}


/* -----------------------------
   Save
----------------------------- */

saveFileButton.addEventListener("click", async () => {
    if (!currentFileHandle) {
        return;
    }

    try {
        const writable =
            await currentFileHandle.createWritable();

        await writable.write(editor.value);
        await writable.close();

        status.textContent = "Saved";

    } catch (error) {
        console.error(error);
        status.textContent =
            "Failed to save";
    }
});


/* -----------------------------
   Save As
----------------------------- */

saveAsFileButton.addEventListener("click", async () => {
    try {
        const handle =
            await window.showSaveFilePicker({
                suggestedName:
                    currentFileHandle?.name ||
                    "document.md",

                types: [
                    {
                        description: "Markdown files",

                        accept: {
                            "text/markdown": [".md"]
                        }
                    }
                ]
            });

        currentFileHandle = handle;

        const writable =
            await handle.createWritable();

        await writable.write(editor.value);
        await writable.close();

        await saveFileHandle(handle);

        fileName.textContent = handle.name;

        saveFileButton.disabled = false;
        saveAsFileButton.disabled = false;

        status.textContent = "Saved";

    } catch (error) {
        if (error.name !== "AbortError") {
            console.error(error);

            status.textContent =
                "Failed to save";
        }
    }
});



function setDirty(dirty) {
    isDirty = dirty;

    saveFileButton.disabled = !dirty;

    if (dirty) {
        status.textContent = "Modified";
    }
}














/* -----------------------------
   Source Editor
----------------------------- */

editor.addEventListener("input", () => {
    if (isUpdating) {
        return;
    }

    setDirty(true);
    updateEditor();
});


function updateEditor() {
    updateWordCount();
    renderMarkdown();
}


/* -----------------------------
   Markdown → HTML
----------------------------- */

function renderMarkdown() {
    if (isUpdating) {
        return;
    }

    const text = editor.value;

    if (!text.trim()) {
        preview.innerHTML =
            '<div class="empty-preview">' +
            'Start writing...' +
            '</div>';

        return;
    }

    isUpdating = true;

    preview.innerHTML =
        marked.parse(text);

    isUpdating = false;
}


/* -----------------------------
   WYSIWYG Editing
----------------------------- */

preview.addEventListener("input", () => {
    if (isUpdating) {
        return;
    }

    isUpdating = true;

    try {
        const markdown =
            turndown.turndown(preview);

        editor.value = markdown;

        setDirty(true);
        updateWordCount();

    } finally {
        isUpdating = false;
    }
});





/* -----------------------------
   Unsaved Changes Warning
----------------------------- */

window.addEventListener("beforeunload", event => {
    if (!isDirty) {
        return;
    }

    event.preventDefault();

    event.returnValue = "";
});









/* -----------------------------
   Word Count
----------------------------- */

function updateWordCount() {
    const text =
        editor.value.trim();

    if (!text) {
        wordCount.textContent =
            "0 words";

        return;
    }

    const words =
        text.split(/\s+/).length;

    wordCount.textContent =
        `${words} ${words === 1 ? "word" : "words"}`;
}


/* -----------------------------
   Keyboard Shortcuts
----------------------------- */

document.addEventListener("keydown", event => {

    if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
    ) {
        event.preventDefault();

        if (currentFileHandle) {
            saveFileButton.click();
        } else {
            saveAsFileButton.click();
        }
    }


    if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "o"
    ) {
        event.preventDefault();

        openFileButton.click();
    }

});


/* -----------------------------
   Service Worker
----------------------------- */

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
        .catch(error => {
            console.error(
                "Service worker registration failed:",
                error
            );
        });
}







/* -----------------------------
   Startup
----------------------------- */

restorePreviousFile();