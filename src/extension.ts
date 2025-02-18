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
