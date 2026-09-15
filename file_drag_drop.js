/* =========================================================
   Drag & Drop Files
   ========================================================= */

document.addEventListener(
    "dragover",
    event => {
        event.preventDefault();
    }
);


document.addEventListener(
    "drop",
    async event => {

        event.preventDefault();
        event.stopPropagation();


        const item =
            [...event.dataTransfer.items]
                .find(item => item.kind === "file");


        if (!item) {
            return;
        }


        if (
            typeof item.getAsFileSystemHandle !==
            "function"
        ) {
            return;
        }


        const handle =
            await item.getAsFileSystemHandle();


        if (
            !handle ||
            handle.kind !== "file"
        ) {
            return;
        }


        /*
         * Make sure it is a Markdown file
         */

        const file =
            await handle.getFile();

        const isMarkdown =
            file.name.endsWith(".md") ||
            file.name.endsWith(".markdown");

        if (!isMarkdown) {
            return;
        }


        /*
         * Save as the current file
         */

        await saveFileHandle(
            handle
        );


        /*
         * Add to recent files
         */

        const recentFiles =
            await getRecentFiles();

        await saveRecentFiles([
            {
                name: handle.name,
                handle
            },
            ...recentFiles.filter(
                recentFile =>
                    recentFile.name !== handle.name
            )
        ]);


        /*
         * Open OUR editor in a new tab
         */

        window.open(
            `/editor.html?load-saved-file=1`,
            "_blank"
        );
    }
);