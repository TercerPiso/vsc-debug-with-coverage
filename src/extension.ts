// Import VS Code API
import * as vscode from 'vscode';

let highlightDecoration: vscode.TextEditorDecorationType;
let activeEditor: vscode.TextEditor | undefined;
let highlightedLines: Set<number> = new Set();

export function activate(context: vscode.ExtensionContext) {
    activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
        return;
    }

    highlightDecoration = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(87, 255, 0, 0.3)',
        isWholeLine: true
    });
    
    vscode.debug.onDidChangeActiveDebugSession(session => {
        console.log("Debug session changed:", session);
        if (session) {
            startTrackingExecution();
        }
    });

    // Agregar botón de 'Debug with Coverage'
    context.subscriptions.push(vscode.commands.registerCommand('extension.debugWithCoverage', async () => {
        console.log("Debug with Coverage command executed.");
        if (!vscode.debug.activeDebugSession) {
            vscode.window.showErrorMessage('No active debug session found. Start a debugging session first.');
            return;
        }

        vscode.debug.startDebugging(undefined, {
            name: 'Debug with Coverage',
            type: 'node',
            request: 'launch',
            program: '${file}',
            runtimeArgs: ['--coverage']
        });
    }));

    vscode.debug.registerDebugConfigurationProvider('node', {
        provideDebugConfigurations(folder, token) {
            return [{
                name: 'Debug with Coverage',
                type: 'node',
                request: 'launch',
                program: '${file}',
                runtimeArgs: ['--coverage']
            }];
        }
    });
}

function startTrackingExecution() {
    vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session: vscode.DebugSession) {
            return {
                onDidSendMessage: (message: any) => {
                    if (message.event === 'stopped' && message.body && message.body.threadId) {
                        updateHighlight();
                    }
                }
            };
        }
    });
}

function updateHighlight() {
    if (!vscode.debug.activeDebugSession) return;

    vscode.debug.activeDebugSession.customRequest('stackTrace', { threadId: 1 }).then(response => {
        if (!response.stackFrames || response.stackFrames.length === 0) return;

        const frame = response.stackFrames[0];
        let filePath = frame.source?.path || '';
        
        // Asegurar que estamos en el archivo correcto (conversión de dist a src)
        if (filePath.includes('/dist/')) {
            filePath = filePath.replace('/dist/', '/src/').replace('.js', '.ts');
        }

        const line = frame.line - 1;
        highlightedLines.add(line);

        console.log('Highlighted lines:', highlightedLines);

        if (activeEditor && activeEditor.document.uri.fsPath === filePath) {
            const decorations = Array.from(highlightedLines).map(line => ({
                range: new vscode.Range(line, 0, line, 10)
            }));
            activeEditor.setDecorations(highlightDecoration, decorations);
        }
    });
}

const isTypeScriptProject = async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return false;

    for (const folder of workspaceFolders) {
        const tsConfig = vscode.Uri.joinPath(folder.uri, 'tsconfig.json');
        const result = await vscode.workspace.fs.stat(tsConfig).then(() => true, () => false);
        if (result) {
            return true;
        }
    }
    return false;
};

export function deactivate() {
    if (highlightDecoration) {
        highlightDecoration.dispose();
    }
}

