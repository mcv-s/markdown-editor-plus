let currentFileHandle = null;
let isUpdating = false;
let isDirty = false;

const editor = document.getElementById("editor");
const openFileButton = document.getElementById("openFile");
const saveFileButton = document.getElementById("saveFile");
const saveAsFileButton = document.getElementById("saveAsFile");
const openLastFileButton = document.getElementById("openLastFile");

const fileName = document.getElementById("fileName");
const status = document.getElementById("status");
const wordCount = document.getElementById("wordCount");
const preview = document.getElementById("preview");

const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced"
});

turndown.keep([
    "br",
    "div",
    "span",
    "iframe",
    "video",
    "audio",
    "details",
    "summary",
    "hr"
]);

turndown.use(
    turndownPluginGfm.gfm
);


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





async function checkLastFile() {
    try {
        const handle =
            await getSavedFileHandle();

        openLastFileButton.hidden =
            !handle;

    } catch (error) {
        console.error(
            "Could not check for last file:",
            error
        );

        openLastFileButton.hidden = true;
    }
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
   Open Last File
----------------------------- */

async function openLastFile() {
    try {
        const handle =
            await getSavedFileHandle();

        if (!handle) {
            status.textContent =
                "No previous file";

            return;
        }

        let permission =
            await handle.queryPermission({
                mode: "readwrite"
            });

        if (permission !== "granted") {
            permission =
                await handle.requestPermission({
                    mode: "readwrite"
                });
        }

        if (permission !== "granted") {
            status.textContent =
                "Permission denied";

            return;
        }

        await loadFile(handle);
        openLastFileButton.hidden = true;

    } catch (error) {
        console.error(error);

        status.textContent =
            "Failed to open last file";
    }
}



openLastFileButton.addEventListener(
    "click",
    openLastFile
);






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

        setDirty(false);

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
                            "text/markdown": [
                                ".md"
                            ]
                        }
                    }
                ]
            });

        const writable =
            await handle.createWritable();

        await writable.write(editor.value);
        await writable.close();

        currentFileHandle = handle;

        await saveFileHandle(handle);

        fileName.textContent = handle.name;

        saveAsFileButton.disabled = false;

        setDirty(false);

        status.textContent = "Saved";

    } catch (error) {
        if (error.name !== "AbortError") {
            console.error(error);

            status.textContent =
                "Failed to save";
        }
    }
});







/* Dirty checking */

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
   Editor Panel Resizing
----------------------------- */

const editorContainer =
    document.querySelector(".editor-container");

const editorDivider =
    document.getElementById("editorDivider");

const togglePanel =
    document.getElementById("togglePanel");

let isDraggingDivider = false;

let editorPanelWidth = 50;

const COLLAPSE_SIZE = 40;


function setPanelWidth(percent) {
    editorPanelWidth =
        Math.max(0, Math.min(100, percent));

    if (editorPanelWidth <= 0) {
        collapseEditor();
        return;
    }

    if (editorPanelWidth >= 100) {
        collapsePreview();
        return;
    }

    editorContainer.style.gridTemplateColumns =
        `calc(${editorPanelWidth}% - 2.5px) 5px calc(${100 - editorPanelWidth}% - 2.5px)`;

    editorDivider.style.display = "block";

    editor.style.display = "";
    preview.style.display = "";

    togglePanel.hidden = true;
}


function startDividerDrag(event) {
    event.preventDefault();

    isDraggingDivider = true;

    editorDivider.classList.add("dragging");

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    document.addEventListener(
        "mousemove",
        moveDivider
    );

    document.addEventListener(
        "mouseup",
        stopDividerDrag
    );
}


function moveDivider(event) {
    if (!isDraggingDivider) {
        return;
    }

    const rect =
        editorContainer.getBoundingClientRect();

    const x =
        event.clientX - rect.left;

    const percent =
        (x / rect.width) * 100;

    setPanelWidth(percent);
}


function stopDividerDrag() {
    if (!isDraggingDivider) {
        return;
    }

    isDraggingDivider = false;

    editorDivider.classList.remove("dragging");

    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    document.removeEventListener(
        "mousemove",
        moveDivider
    );

    document.removeEventListener(
        "mouseup",
        stopDividerDrag
    );
}


function collapseEditor() {
    editorPanelWidth = 0;

    editor.style.display = "none";
    editorDivider.style.display = "none";
    preview.style.display = "block";

    editorContainer.style.gridTemplateColumns =
        "1fr";

    togglePanel.textContent = "Open Raw";
    togglePanel.hidden = false;
}


function collapsePreview() {
    editorPanelWidth = 100;

    preview.style.display = "none";
    editorDivider.style.display = "none";
    editor.style.display = "block";

    editorContainer.style.gridTemplateColumns =
        "1fr";

    togglePanel.textContent = "Open Preview";
    togglePanel.hidden = false;
}


function restoreSplit() {
    editorPanelWidth = 50;

    editor.style.display = "";
    preview.style.display = "";
    editorDivider.style.display = "block";

    editorContainer.style.gridTemplateColumns =
        "calc(50% - 2.5px) 5px calc(50% - 2.5px)";

    togglePanel.hidden = true;
}


editorDivider.addEventListener(
    "mousedown",
    startDividerDrag
);


togglePanel.addEventListener(
    "click",
    restoreSplit
);














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










checkLastFile();
