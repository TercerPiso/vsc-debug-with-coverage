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
        if (session) {
            startTrackingExecution();
        }
    });

    // Agregar botón de 'Debug with Coverage'
    context.subscriptions.push(vscode.commands.registerCommand('extension.debugWithCoverage', async () => {
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
    
    const stackTraceRequest = { command: 'stackTrace', arguments: { threadId: 1 } };
    
    vscode.debug.activeDebugSession.customRequest('stackTrace', stackTraceRequest.arguments).then(response => {
        if (!response.stackFrames || response.stackFrames.length === 0) return;
        
        const frame = response.stackFrames[0];
        const line = frame.line - 1;
        highlightedLines.add(line);

        if (activeEditor) {
            const decorations = Array.from(highlightedLines).map(line => ({
                range: new vscode.Range(line, 0, line, 0)
            }));
            activeEditor.setDecorations(highlightDecoration, decorations);
        }
    });
}

export function deactivate() {
    if (highlightDecoration) {
        highlightDecoration.dispose();
    }
}

