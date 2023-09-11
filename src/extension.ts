import * as vscode from 'vscode';
import * as openai from 'openai';
import * as fs from 'fs';

export function clearActiveWindow(editor: vscode.TextEditor | undefined) {
    if (editor) {
        const document = editor.document;
        const lastLine = document.lineAt(document.lineCount - 1);
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        const edit = new vscode.TextEdit(fullRange, '');
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(editor.document.uri, [edit]);
        vscode.workspace.applyEdit(workspaceEdit);
    }
}

async function insertLines(editor: vscode.TextEditor | undefined, lines: string[], index: number) {
    if (!editor || index >= lines.length) {
        return;
    }

    const line = lines[index];

    await editor.edit(editBuilder => {
        const lineCount = editor.document.lineCount;
        editBuilder.insert(new vscode.Position(lineCount, 0), line + '\n');
    });

    // Wait briefly before inserting the next line (adjust the delay as needed)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Insert the next line recursively
    await insertLines(editor, lines, index + 1);
}

async function getUserInput(): Promise<{ command: string, fileName: string, prompt: string }> {
    const input = await vscode.window.showInputBox({
        prompt: 'Enter your question (optional command, filename, and free text; syntax is COMMAND|<FILENAME>|FREE_TEXT, COMMAND|FREE_TEXT, <FILENAME>|FREE_TEXT, or just FREE_TEXT)',
        value: '',
    });

    if (!input) {
        return { command: '', fileName: '', prompt: '' }; // Return empty values if input is not provided
    }

    const parts = input.split('|').map((part) => part.trim());

    // Check for the first format: COMMAND|<filename>|FREE_TEXT
    if (parts.length === 3 && parts[0] && parts[1].startsWith('<') && parts[1].endsWith('>') && parts[2]) {
        const command = parts[0];
        const fileName = validateFileName(parts[1].slice(1, -1)); // Remove angle brackets
        const prompt = parts[2];
        return { command, fileName, prompt };
    }

    // Check for the second format: COMMAND|FREE_TEXT
    if (parts.length === 2 && parts[0] && parts[1]) {
        const command = parts[0];
        const fileName = '';
        const prompt = parts[1];
        return { command, fileName, prompt };
    }

    // Check for the third format: <filename>|FREE_TEXT
    if (parts.length === 2 && parts[0].startsWith('<') && parts[0].endsWith('>') && parts[1]) {
        const command = '';
        const fileName = validateFileName(parts[0].slice(1, -1)); // Remove angle brackets
        const prompt = parts[1];
        return { command, fileName, prompt };
    }

    // Check for the fourth format: FREE_TEXT
    if (parts.length === 1 && parts[0]) {
        const command = '';
        const fileName = '';
        const prompt = parts[0];
        return { command, fileName, prompt };
    }

    // Default case: Invalid input
    vscode.window.showErrorMessage('Invalid input format.');
    return getUserInput();
}

function validateFileName(fileName: string): string {
    // Define a regular expression to check for valid file name characters
    const fileNameRegex = /^[a-zA-Z0-9_\-]+$/; // This regex allows letters, numbers, underscores, and hyphens

    if (fileNameRegex.test(fileName)) {
        return fileName;
    } else {
        vscode.window.showErrorMessage('Invalid file name. Please use only letters, numbers, underscores, and hyphens.');
        return ''; // Return an empty string if the file name is invalid
    }
}

async function saveEditorToFile(editor: vscode.TextEditor | undefined, fileName: string) {
    if (editor) {
        // Check if the editor has content
        if (editor.document.getText()) {
            // Write the editor's content to the file
            fs.writeFileSync(fileName, editor.document.getText(), 'utf8');
            vscode.window.showInformationMessage(`Saved content to ${fileName}`);
        } else {
            vscode.window.showWarningMessage('The editor is empty. Nothing to save.');
        }
    }
}

export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('extension.openGGVSCodeChat', async () => {

        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            vscode.window.showErrorMessage("OpenAI API key not found. Make sure you've set the OPENAI_API_KEY environment variable.");
            return;
        }        

        const openaiInstance = new openai.OpenAI({ apiKey });

        const userInput = await getUserInput();
        const command = userInput.command;
        const fileName = userInput.fileName;
        const prompt = userInput.prompt;

        const outputChannel = vscode.window.createOutputChannel('GGVscode Output');
        // Clear the output channel
        outputChannel.clear();

        // Grab the editor active window
        const editor = vscode.window.activeTextEditor;
        // Grab the content of the active window
        let currentSourceCodeOnActiveWindow = '';
        if (editor) {
            currentSourceCodeOnActiveWindow = editor.document.getText();
        }        

        let updatedEditor = null; // Declare 'updatedEditor' with an initial value of null

        // Check if the command is not passed or equal to "new"
        if (!command || command.toLowerCase() === "new") {
            // Create a new untitled text document
            const untitledDocument = await vscode.workspace.openTextDocument({ content: '' });
            await vscode.window.showTextDocument(untitledDocument);

            // Get the updated active editor
            updatedEditor = vscode.window.activeTextEditor; // Update 'updatedEditor' with the new editor
        } else {            
            clearActiveWindow(editor);   
            // Get the updated active editor
            updatedEditor = vscode.window.activeTextEditor; // Update 'updatedEditor' with the new editor
        }

        const system = `
        You are a senior Software Engineer and Software developer who has mastered Java, Rust, Python, Go, and Javascript.
        You know everything about those languages. 
        You know exactly how to solve all possible coding challenges using one of those languages.
        You always reply with professional-grade source code.
        You always reply by providing the source code.
        You will always have an answer to any coding questions related to those languages.
        `;

        const prep_prompt = 'I am a software developer in Java, Rust, Python, Go and Javascript and you are a powerful AI robot that acts as a Software Engineer.'

        const syntax_to_avoid = '```python ```rust ```go ```java ```javascript'

        const post_prompt = `do not use Markdown syntax and do not use Markdown Syntax Highlighting like ${syntax_to_avoid}; answer must contain only source code; your answer cannot contain explanations of any sorts; always provide full source code and not just snippets`

        let fullPrompt = `Initial context: ${prep_prompt}\nInstructions on your answer: ${post_prompt}\nThe question is: ${prompt}`
        outputChannel.append("#####################");
        outputChannel.append('\n');
        outputChannel.append(`Full prompt: ${fullPrompt}`);
        outputChannel.append('\n');
        outputChannel.append("#####################")
        outputChannel.show(true);

        const completion = await openaiInstance.chat.completions.create({
            model: 'gpt-4-0613',
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: `Digest this source code even if it is empty; just reply OK\n${currentSourceCodeOnActiveWindow}` },
                { role: 'assistant', content: 'OK' },
                { role: 'user', content: fullPrompt },
            ],
            stream: false,
            temperature: 0.01,
            max_tokens: 4096,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });

        let outputText = `${completion.choices[0]?.message?.content}`

        const regex = /```(python|rust|java|go|javascript)\n([\s\S]*?)\n```/;
        const match = outputText.match(regex);

        let contentToBeSentOnActiveWindow = '';

        if (match) {
            contentToBeSentOnActiveWindow = match[2];
        } else {
            contentToBeSentOnActiveWindow = `${outputText}`
        }

        // Split the content received from ChatGPT into lines
        const gpt_content_by_lines = contentToBeSentOnActiveWindow.split('\n');

        if (vscode.window.activeTextEditor) {        
            // Send new lines one by one to the active window
            insertLines(updatedEditor, gpt_content_by_lines, 0);
        }                
        
        if (fileName) {
            // Save the active window to the specified file
            saveEditorToFile(vscode.window.activeTextEditor, fileName);
        }

    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
