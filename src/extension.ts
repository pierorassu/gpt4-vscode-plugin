import * as vscode from 'vscode';
import * as openai from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// Function to clear the content of the active editor
async function clearActiveWindow() {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
        const document = activeEditor.document;
        const firstLine = document.lineAt(0);
        const lastLine = document.lineAt(document.lineCount - 1);

        const range = new vscode.Range(
            firstLine.range.start,
            lastLine.range.end
        );

        // Use the TextEditorEdit class to perform the edit
        activeEditor.edit((editBuilder: vscode.TextEditorEdit) => {
            editBuilder.replace(range, ''); // Replace the content with an empty string
        });
    }
}

// Function to insert lines into the active editor
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

// Function to get user input for command, file name, and prompt
export async function getUserInput(): Promise<{ command: string, fileName: string, prompt: string }> {
    const input = await vscode.window.showInputBox({
        prompt: 'Enter your question (optional command, filename, and free text; syntax is COMMAND|<FILENAME>|FREE_TEXT, COMMAND|FREE_TEXT, <FILENAME>|FREE_TEXT, or just FREE_TEXT)',
        value: '',
    });

    if (!input) {
        return { command: '', fileName: '', prompt: '' }; // Return empty values if input is not provided
    }

    // Check for various input formats and extract command, filename, and prompt
    const regex = /^(.+?)\|<(.+?)>(.+)$/; // Command|<filename>FREE_TEXT
    const match = input.match(regex);

    if (match) {
        const command = match[1].trim();
        const fileName = match[2].trim();
        const prompt = match[3].trim();
        return { command, fileName, prompt };
    }

    const parts = input.split('|').map((part) => part.trim()); // Command|FREE_TEXT
    if (parts.length === 2) {
        const command = parts[0];
        const fileName = '';
        const prompt = parts[1];
        return { command, fileName, prompt };
    }

    if (input.startsWith('<')) { // <filename>FREE_TEXT
        const fileNameEndIndex = input.indexOf('>');
        if (fileNameEndIndex !== -1) {
            const command = 'new';
            const fileName = input.slice(1, fileNameEndIndex);
            const prompt = input.slice(fileNameEndIndex + 1).trim();
            return { command, fileName, prompt };
        }
    }

    // If none of the above formats match, treat the entire input as prompt
    return { command: 'new', fileName: '', prompt: input };
}

// Function to validate a file name
export function validateFileName(fileName: string, errorCallback?: (message: string) => void): boolean {
    // Define a regular expression to check for valid file name characters
    const fileNameRegex = /^[a-zA-Z0-9_\-\.]+$/; // This regex allows letters, numbers, underscores, hyphens, and dots

    const isValid = fileNameRegex.test(fileName);

    if (!isValid && errorCallback) {
        errorCallback('Invalid file name. Please use only letters, numbers, underscores, hyphens, and dots.');
    }

    return isValid;
}

// Function to wait for the content of the active editor to change
async function waitForEditorContentUpdate(editor: vscode.TextEditor | undefined): Promise<void> {
    if (!editor) {
        return; // Return early if the editor is undefined
    }

    const document = editor.document;
    const initialContent = document.getText();

    // Define a function to check if the editor content has changed
    function hasContentChanged(): boolean {
        const currentContent = document.getText();
        return currentContent !== initialContent;
    }

    // Wait for the editor content to change or a timeout (adjust the timeout as needed)
    const timeoutMs = 5000; // Adjust this timeout as needed
    const startTime = Date.now();

    while (!hasContentChanged() && Date.now() - startTime < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Function to create and open a new file in VSCode
async function createAndOpenNewFile(fileName: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]; // Use the first workspace folder if available

    if (workspaceFolder) {
        const filePath = path.join(workspaceFolder.uri.fsPath, fileName);

        // Create an empty new file
        fs.writeFileSync(filePath, '');

        // Open the new file in the active editor
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);
    }
}

export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('extension.openGGVSCodeChat', async () => {

        const apiKey = process.env.OPENAI_API_KEY;

        const cwd = process.cwd();

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
        
        if (command && command.toLowerCase() === "new") {
            if (validateFileName(fileName, vscode.window.showErrorMessage)) {
                // Create and open the file
                await createAndOpenNewFile(fileName);                        
            }
        }
                 
        const editorToBeSaved = vscode.window.activeTextEditor;
        // Clear the active editor
        await clearActiveWindow() 
        // Really making sure that the activeWindow is clear!
        await clearActiveWindow()          

        const system = `
        You are a Software Engineer and Software developer who has mastered all program languages.
        You like to solve coding challenges and you always try to find the best and omptimal solution for a coding question.
        You always reply with professional-grade source code.
        You always reply by providing the whole source code back, either new or updated.
        Your code snippets are always enclosed in markdown syntax, for example for python you will enclose your code within \`\`\`python\`\`\`
        `;

        const prep_prompt = 'I am a software developer in Java, Rust, Python, Go and Javascript and you are a powerful AI robot that acts as a Software Engineer.'

        const syntax_to_avoid = '```python ```rust ```go ```java ```javascript'

        const post_prompt = `do not use Markdown syntax and do not use Markdown Syntax Highlighting for example like ${syntax_to_avoid} and similar; answer must contain only source code; your answer cannot contain explanations of any sorts; always provide the full source code`

        let fullPrompt = `Initial context: ${prep_prompt}\nInstructions on your answer: ${post_prompt}\nThe question is: ${prompt}`

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

        if (outputText === "[FAILURE}") {
            vscode.window.showErrorMessage("This extension only works on Java, Rust, Python, Go and Javascript");
            return; // Exit the command if it's a failure
        }        

        //const regex = /```(python|rust|java|go|javascript)\n([\s\S]*?)\n```/;
        const regex = /```([A-Za-z]+|[Cc]\+\+|[Cc]\#)\n([\s\S]*?)\n```/;
        const match = outputText.match(regex);

        let contentToBeSentOnActiveWindow = '';

        if (match) {
            contentToBeSentOnActiveWindow = match[2];
        } else {
            contentToBeSentOnActiveWindow = `${outputText}`
        }

        // Split the content received from ChatGPT   into lines
        const gpt_content_by_lines = contentToBeSentOnActiveWindow.split('\n');                    

        if (editorToBeSaved){

            await insertLines(editorToBeSaved, gpt_content_by_lines, 0);

            // Ensure the content is fully updated
            await waitForEditorContentUpdate(editorToBeSaved);       

            // Save the content to the file
            editorToBeSaved?.document.save();
        }        

    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
