
let currentFileHandle = null;
let isUpdating = false;
let isDirty = false;
let isEditing = true;

const storage = window.StorageModule;

if (!storage) {
    throw new Error(
        "StorageModule is not available. " +
        "Make sure storage_module.js loads before program.js."
    );
}


/* =========================================================
   Markdown File Configuration
   ========================================================= */

const MARKDOWN_FILE_TYPES = [
    {
        description: "Markdown files",

        accept: {
            "text/markdown": [
                ".md",
                ".markdown"
            ]
        }
    }
];

const MARKDOWN_FILE_ACCEPT =
    ".md,.markdown,text/markdown";


const MARKDOWN_STORAGE_CONFIG = {

    /*
     * File type
     */

    defaultName:
        "document.md",

    mimeType:
        "text/markdown;charset=utf-8",

    readMode:
        "text",


    /*
     * File picker
     */

    types:
        MARKDOWN_FILE_TYPES,

    accept:
        MARKDOWN_FILE_ACCEPT,


    /*
     * Last opened file
     */

    lastOpenedFileKey:
        "markdown-editor-current-file",


    /*
     * File permissions
     */

    permissionMode:
        "readwrite",


    /*
     * Remember opened files
     */

    rememberFile:
        true
};


/* =========================================================
   DOM Elements
   ========================================================= */

const editor =
    document.getElementById(
        "editor"
    );

const openFileButton =
    document.getElementById(
        "openFile"
    );

const saveFileButton =
    document.getElementById(
        "saveFile"
    );

const saveAsFileButton =
    document.getElementById(
        "saveAsFile"
    );

const openLastFileButton =
    document.getElementById(
        "openLastFile"
    );

const editFileButton =
    document.getElementById(
        "editFile"
    );

const fileName =
    document.getElementById(
        "fileName"
    );

const status =
    document.getElementById(
        "status"
    );

const wordCount =
    document.getElementById(
        "wordCount"
    );

const preview =
    document.getElementById(
        "preview"
    );


/* =========================================================
   Turndown
   ========================================================= */

const turndown =
    new TurndownService({

        headingStyle:
            "atx",

        bulletListMarker:
            "-",

        codeBlockStyle:
            "fenced"
    });


turndown.keep([
    "div",
    "span",
    "iframe",
    "video",
    "audio",
    "details",
    "summary",
    "hr"
]);


turndown.addRule(
    "preserveBr",
    {
        filter:
            function (node) {

                return (
                    node.nodeName ===
                    "BR"
                );
            },

        replacement:
            function () {

                return "<br>";
            }
    }
);


turndown.use(
    turndownPluginGfm.gfm
);


/* =========================================================
   Preview Margin
   ========================================================= */

const previewMarginSlider =
    document.getElementById(
        "previewMargin"
    );

const PREVIEW_MARGIN_KEY =
    "previewMargin";


const savedPreviewMargin =
    storage.getStorage(
        PREVIEW_MARGIN_KEY
    );


if (
    savedPreviewMargin !==
    null
) {

    previewMarginSlider.value =
        savedPreviewMargin;
}


function updatePreviewPadding() {

    const value =
        previewMarginSlider.value;


    preview.style.padding =
        `32px ${value}%`;


    storage.setStorage(
        PREVIEW_MARGIN_KEY,
        value
    );
}


previewMarginSlider.addEventListener(
    "input",
    updatePreviewPadding
);


updatePreviewPadding();


/* =========================================================
   Check Last Opened File
   ========================================================= */

async function checkLastFile() {

    if (
        !storage.supportsFileSystemAccess
    ) {

        openLastFileButton.hidden =
            true;

        return;
    }


    try {

        const handle =
            await storage.getLastOpenedFile(
                MARKDOWN_STORAGE_CONFIG
                    .lastOpenedFileKey
            );


        openLastFileButton.hidden =
            !handle;

    } catch (error) {

        console.error(
            "Could not check for last file:",
            error
        );


        openLastFileButton.hidden =
            true;
    }
}


/* =========================================================
   Open File
   ========================================================= */

openFileButton.addEventListener(
    "click",
    async () => {

        try {

            const handle =
                await storage.selectFile(
                    MARKDOWN_STORAGE_CONFIG
                );


            if (!handle) {
                return;
            }


            /*
             * File System Access API
             */

            if (
                typeof handle.getFile ===
                "function"
            ) {

                await loadFile(
                    handle
                );

                return;
            }


            /*
             * Fallback File object
             */

            await loadFallbackFile(
                handle
            );

        } catch (error) {

            console.error(
                error
            );


            status.textContent =
                "Failed to open file";
        }
    }
);


/* =========================================================
   Edit File
   ========================================================= */

editFileButton.addEventListener(
    "click",
    () => {

        setEditing(
            true
        );


        editor.focus();


        status.textContent =
            "Editing";
    }
);







/* -----------------------------
   Ctrl + Click Links in Preview
----------------------------- */

preview.addEventListener("click", event => {
    const link =
        event.target.closest("a");

    if (!link) {
        return;
    }

    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();

        window.open(
            link.href,
            "_blank",
            "noopener,noreferrer"
        );
    }
});


/* -----------------------------
   Ctrl + Hover Link Cursor
----------------------------- */

let ctrlHeld = false;

document.addEventListener("keydown", event => {
    if (event.key === "Control" || event.key === "Meta") {
        ctrlHeld = true;
        preview.classList.add("ctrl-held");
    }
});

document.addEventListener("keyup", event => {
    if (event.key === "Control" || event.key === "Meta") {
        ctrlHeld = false;
        preview.classList.remove("ctrl-held");
    }
});

window.addEventListener("blur", () => {
    ctrlHeld = false;
    preview.classList.remove("ctrl-held");
});







/* =========================================================
   Load File
   ========================================================= */

async function loadFile(
    handle
) {

    currentFileHandle =
        handle;


    const contents =
        await storage.readFile(
            handle,
            MARKDOWN_STORAGE_CONFIG
        );


    editor.value =
        contents;


    fileName.textContent =
        storage.getFileName(
            handle,
            MARKDOWN_STORAGE_CONFIG
        );


    saveFileButton.disabled =
        true;


    saveAsFileButton.disabled =
        false;


    /*
     * Store this as the last opened file.
     */

    await storage.saveLastOpenedFile(
        handle,
        MARKDOWN_STORAGE_CONFIG
            .lastOpenedFileKey
    );


    setDirty(
        false
    );


    status.textContent =
        "Opened";


    updateEditor();


    fullscreenPreview();
}


/* =========================================================
   Load Fallback File
   ========================================================= */

async function loadFallbackFile(
    file
) {

    const contents =
        await storage.readFile(
            file,
            MARKDOWN_STORAGE_CONFIG
        );


    editor.value =
        contents;


    /*
     * File objects cannot be written back
     * to their original location.
     */

    currentFileHandle =
        null;


    fileName.textContent =
        storage.getFileName(
            file,
            MARKDOWN_STORAGE_CONFIG
        );


    saveFileButton.disabled =
        true;


    saveAsFileButton.disabled =
        false;


    setDirty(
        false
    );


    updateEditor();


    status.textContent =
        "Opened";


    fullscreenPreview();
}


/* =========================================================
   Open Last File
   ========================================================= */

async function openLastFile() {

    if (
        !storage.supportsFileSystemAccess
    ) {

        status.textContent =
            "Previous files cannot be reopened automatically in this browser.";

        return;
    }


    try {

        const handle =
            await storage.getLastOpenedFile(
                MARKDOWN_STORAGE_CONFIG
                    .lastOpenedFileKey
            );


        if (!handle) {

            status.textContent =
                "No previous file";

            return;
        }


        const permission =
            await storage.requestFilePermission(
                handle,
                MARKDOWN_STORAGE_CONFIG
            );


        if (!permission) {

            status.textContent =
                "Permission denied";

            return;
        }


        await loadFile(
            handle
        );


        openLastFileButton.hidden =
            true;

    } catch (error) {

        console.error(
            error
        );


        /*
         * The stored handle may no longer
         * be valid.
         */

        await storage
            .clearLastOpenedFile(
                MARKDOWN_STORAGE_CONFIG
                    .lastOpenedFileKey
            )
            .catch(
                () => { }
            );


        status.textContent =
            "Failed to open last file";
    }
}


openLastFileButton.addEventListener(
    "click",
    openLastFile
);


/* =========================================================
   Save
   ========================================================= */

saveFileButton.addEventListener(
    "click",
    async () => {

        if (!isDirty) {
            return;
        }


        /*
         * Save directly to the current
         * writable file handle.
         */

        if (
            currentFileHandle &&
            typeof currentFileHandle.createWritable ===
            "function"
        ) {

            try {

                await storage.saveFile(
                    currentFileHandle,
                    editor.value,
                    MARKDOWN_STORAGE_CONFIG
                );


                setDirty(
                    false
                );


                status.textContent =
                    "Saved";

            } catch (error) {

                console.error(
                    error
                );


                status.textContent =
                    "Failed to save";
            }


            return;
        }


        /*
         * No writable handle.
         *
         * Download instead.
         */

        downloadMarkdown();
    }
);


/* =========================================================
   Download
   ========================================================= */

function downloadMarkdown() {

    const name =
        fileName.textContent &&
            fileName.textContent !==
            "Untitled"

            ? fileName.textContent

            : MARKDOWN_STORAGE_CONFIG
                .defaultName;


    storage.downloadFile(
        editor.value,
        name,
        MARKDOWN_STORAGE_CONFIG
    );


    setDirty(
        false
    );


    status.textContent =
        "Downloaded";
}


/* =========================================================
   Save As
   ========================================================= */

saveAsFileButton.addEventListener(
    "click",
    async () => {

        if (
            storage.supportsFileSystemAccess
        ) {

            try {

                const handle =
                    await storage.selectSaveLocation({

                        ...MARKDOWN_STORAGE_CONFIG,

                        suggestedName:
                            currentFileHandle?.name ||
                            MARKDOWN_STORAGE_CONFIG
                                .defaultName
                    });


                if (!handle) {
                    return;
                }


                await storage.saveFile(
                    handle,
                    editor.value,
                    MARKDOWN_STORAGE_CONFIG
                );


                currentFileHandle =
                    handle;


                fileName.textContent =
                    storage.getFileName(
                        handle,
                        MARKDOWN_STORAGE_CONFIG
                    );


                saveAsFileButton.disabled =
                    false;


                setDirty(
                    false
                );


                /*
                 * saveFile() already stores
                 * the handle as last opened.
                 */

                openLastFileButton.hidden =
                    true;


                status.textContent =
                    "Saved";

            } catch (error) {

                console.error(
                    error
                );


                status.textContent =
                    "Failed to save";
            }


            return;
        }


        /*
         * Browser fallback
         */

        downloadMarkdown();
    }
);


/* =========================================================
   Dirty Checking
   ========================================================= */

function setDirty(
    dirty
) {

    isDirty =
        dirty;


    /*
     * Save is only available when:
     *
     * 1. The document has changes
     * 2. We have a real writable file handle
     */

    saveFileButton.disabled =
        !dirty ||
        !currentFileHandle ||
        typeof currentFileHandle.createWritable !==
        "function";


    /*
     * Save As is always available.
     */

    saveAsFileButton.disabled =
        false;


    if (dirty) {

        status.textContent =
            "Modified";
    }
}


/* =========================================================
   Editing State
   ========================================================= */

function setEditing(
    enabled
) {

    isEditing =
        enabled;


    editor.readOnly =
        !enabled;


    preview.contentEditable =
        enabled
            ? "true"
            : "false";


    editFileButton.hidden =
        enabled;
}


/* =========================================================
   Source Editor
   ========================================================= */

editor.addEventListener(
    "input",
    () => {

        if (isUpdating) {
            return;
        }


        setDirty(
            true
        );


        updateEditor();
    }
);


function updateEditor() {

    updateWordCount();

    renderMarkdown();
}


/* =========================================================
   Markdown → HTML
   ========================================================= */

function renderMarkdown() {

    if (isUpdating) {
        return;
    }


    const text =
        editor.value;


    if (!text.trim()) {

        preview.innerHTML =
            '<div class="empty-preview">' +
            "Start writing..." +
            "</div>";

        return;
    }


    isUpdating =
        true;


    preview.innerHTML =
        marked.parse(
            text
        );


    isUpdating =
        false;
}


/* =========================================================
   Editor Panel Resizing
   ========================================================= */

const editorContainer =
    document.querySelector(
        ".editor-container"
    );

const editorDivider =
    document.getElementById(
        "editorDivider"
    );

const togglePanel =
    document.getElementById(
        "togglePanel"
    );

const DIVIDER_POSITION_KEY =
    "editorDividerPosition";

const COLLAPSE_SIZE =
    40;

let isDraggingDivider =
    false;

let editorPanelWidth =
    Number(
        storage.getStorage(
            DIVIDER_POSITION_KEY
        )
    ) || 50;


function setPanelWidth(
    percent
) {

    editorPanelWidth =
        Math.max(
            0,
            Math.min(
                100,
                percent
            )
        );


    storage.setStorage(
        DIVIDER_POSITION_KEY,
        editorPanelWidth
    );


    if (
        editorPanelWidth <= 0
    ) {

        collapseEditor();

        return;
    }


    if (
        editorPanelWidth >= 100
    ) {

        collapsePreview();

        return;
    }


    editorContainer.style.gridTemplateColumns =
        `calc(${editorPanelWidth}% - 2.5px) 5px calc(${100 - editorPanelWidth}% - 2.5px)`;


    editorDivider.style.display =
        "block";


    editor.style.display =
        "";


    preview.style.display =
        "";


    togglePanel.hidden =
        true;
}


function restoreDividerPosition() {

    const saved =
        Number(
            storage.getStorage(
                DIVIDER_POSITION_KEY
            )
        );


    if (
        Number.isFinite(saved) &&
        saved > 0 &&
        saved < 100
    ) {

        setPanelWidth(
            saved
        );
    }
}


function startDividerDrag(
    event
) {

    event.preventDefault();


    isDraggingDivider =
        true;


    editorDivider.classList.add(
        "dragging"
    );


    document.body.style.cursor =
        "col-resize";


    document.body.style.userSelect =
        "none";


    document.addEventListener(
        "mousemove",
        moveDivider
    );


    document.addEventListener(
        "mouseup",
        stopDividerDrag
    );
}


function moveDivider(
    event
) {

    if (!isDraggingDivider) {
        return;
    }


    const rect =
        editorContainer.getBoundingClientRect();


    const x =
        event.clientX -
        rect.left;


    const percent =
        (x / rect.width) *
        100;


    setPanelWidth(
        percent
    );
}


function stopDividerDrag() {

    if (!isDraggingDivider) {
        return;
    }


    isDraggingDivider =
        false;


    editorDivider.classList.remove(
        "dragging"
    );


    document.body.style.cursor =
        "";


    document.body.style.userSelect =
        "";


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

    editorPanelWidth =
        0;


    editor.style.display =
        "none";


    editorDivider.style.display =
        "none";


    preview.style.display =
        "block";


    editorContainer.style.gridTemplateColumns =
        "1fr";


    togglePanel.textContent =
        "Open Raw";


    togglePanel.hidden =
        false;
}


function collapsePreview() {

    editorPanelWidth =
        100;


    preview.style.display =
        "none";


    editorDivider.style.display =
        "none";


    editor.style.display =
        "block";


    editorContainer.style.gridTemplateColumns =
        "1fr";


    togglePanel.textContent =
        "Open Preview";


    togglePanel.hidden =
        false;
}


function fullscreenPreview() {

    editorPanelWidth =
        0;


    editor.style.display =
        "none";


    editorDivider.style.display =
        "none";


    preview.style.display =
        "block";


    editorContainer.style.gridTemplateColumns =
        "1fr";


    togglePanel.textContent =
        "Open Raw";


    togglePanel.hidden =
        false;


    setEditing(
        false
    );
}


function restoreSplit() {

    editorPanelWidth =
        50;


    editor.style.display =
        "";


    preview.style.display =
        "";


    editorDivider.style.display =
        "block";


    editorContainer.style.gridTemplateColumns =
        "calc(50% - 2.5px) 5px calc(50% - 2.5px)";


    togglePanel.hidden =
        true;
}


editorDivider.addEventListener(
    "mousedown",
    startDividerDrag
);


togglePanel.addEventListener(
    "click",
    restoreSplit
);


/* =========================================================
   WYSIWYG Editing
   ========================================================= */

preview.addEventListener(
    "input",
    () => {

        if (isUpdating) {
            return;
        }


        isUpdating =
            true;


        try {

            const markdown =
                turndown.turndown(
                    preview
                );


            editor.value =
                markdown;


            setDirty(
                true
            );


            updateWordCount();

        } finally {

            isUpdating =
                false;
        }
    }
);


/* =========================================================
   Unsaved Changes Warning
   ========================================================= */

window.addEventListener(
    "beforeunload",
    event => {

        if (!isDirty) {
            return;
        }


        event.preventDefault();


        event.returnValue =
            "";
    }
);


/* =========================================================
   Word Count
   ========================================================= */

function updateWordCount() {

    const text =
        editor.value.trim();


    if (!text) {

        wordCount.textContent =
            "0 words";

        return;
    }


    const words =
        text.split(
            /\s+/
        ).length;


    wordCount.textContent =
        `${words} ${words === 1
            ? "word"
            : "words"
        }`;
}


/* =========================================================
   Keyboard Shortcuts
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            (event.ctrlKey ||
                event.metaKey) &&
            event.key.toLowerCase() ===
            "s"
        ) {

            event.preventDefault();


            if (
                currentFileHandle &&
                typeof currentFileHandle.createWritable ===
                "function"
            ) {

                saveFileButton.click();

            } else {

                saveAsFileButton.click();
            }
        }


        if (
            (event.ctrlKey ||
                event.metaKey) &&
            event.key.toLowerCase() ===
            "o"
        ) {

            event.preventDefault();


            openFileButton.click();
        }
    }
);


/* =========================================================
   Service Worker
   ========================================================= */

if (
    "serviceWorker" in navigator
) {

    navigator.serviceWorker
        .register(
            "./sw.js"
        )
        .catch(
            error => {

                console.error(
                    "Service worker registration failed:",
                    error
                );
            }
        );
}


/* =========================================================
   Startup URL Handling
   ========================================================= */

async function handleStartup() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const shouldRestore =
        params.get(
            "restore"
        ) === "1";


    const filePath =
        params.get(
            "file-path"
        );


    /*
     * file-path takes priority.
     */

    if (filePath) {

        await openFileFromPath(
            filePath
        );


        removeStartupParams();


        return;
    }


    /*
     * Explicit restore request.
     */

    if (shouldRestore) {

        await openLastFile();


        removeStartupParams();


        return;
    }


    /*
     * Normal editor startup.
     */

    checkLastFile();
}


function removeStartupParams() {

    const url =
        new URL(
            window.location.href
        );


    url.search =
        "";


    window.history.replaceState(
        {},
        document.title,
        url.pathname +
        url.hash
    );
}


/* =========================================================
   Open File From URL / Path
   ========================================================= */

async function openFileFromPath(
    filePath
) {

    try {

        status.textContent =
            "Loading...";


        const result =
            await storage.openFileFromPath(
                filePath,
                MARKDOWN_STORAGE_CONFIG
            );


        if (!result) {
            return;
        }


        /*
         * Local file opened through
         * the File System Access API.
         */

        if (
            result.type === "local" &&
            result.handle
        ) {

            currentFileHandle =
                result.handle;


            editor.value =
                result.contents;


            fileName.textContent =
                result.name;


            saveFileButton.disabled =
                true;


            saveAsFileButton.disabled =
                false;


            setDirty(
                false
            );


            updateEditor();


            fullscreenPreview();


            status.textContent =
                "Opened local file";


            return;
        }


        /*
         * Remote file.
         */

        if (
            result.type ===
            "remote"
        ) {

            editor.value =
                result.contents;


            currentFileHandle =
                null;


            fileName.textContent =
                result.name;


            saveFileButton.disabled =
                true;


            saveAsFileButton.disabled =
                false;


            setDirty(
                false
            );


            updateEditor();


            fullscreenPreview();


            status.textContent =
                "Opened remote file";
        }

    } catch (error) {

        console.error(
            "Failed to open file:",
            error
        );


        status.textContent =
            "Failed to open file";
    }
}


/* =========================================================
   PWA File Handler
   ========================================================= */

if (
    "launchQueue" in window
) {

    window.launchQueue.setConsumer(
        async launchParams => {

            if (
                !launchParams.files ||
                !launchParams.files.length
            ) {

                return;
            }


            const handle =
                launchParams.files[0];


            try {

                /*
                 * Make sure this is
                 * actually a file.
                 */

                if (
                    handle.kind !==
                    "file"
                ) {

                    return;
                }


                await loadFile(
                    handle
                );


                status.textContent =
                    "Opened file";

            } catch (error) {

                console.error(
                    "Failed to open launched file:",
                    error
                );


                status.textContent =
                    "Failed to open file";
            }
        }
    );
}


/* =========================================================
   Startup
   ========================================================= */

handleStartup();

restoreDividerPosition();

