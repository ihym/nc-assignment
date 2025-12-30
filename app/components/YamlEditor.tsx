'use client';

import { useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { FileCode2, AlertCircle } from 'lucide-react';
import { postCompletionsApiPyCompletionsPost } from '../api/sdk.gen';

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  parseError: string | null;
}

export function YamlEditor({ value, onChange, parseError }: YamlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) {
      const position = editor.getPosition();
      editor.setValue(value);
      if (position) {
        const lineCount = editor.getModel()?.getLineCount() ?? 1;
        editor.setPosition({
          lineNumber: Math.min(position.lineNumber, lineCount),
          column: 1,
        });
      }
    }
  }, [value]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Register completion provider
    monaco.languages.registerCompletionItemProvider('yaml', {
      triggerCharacters: [':', ' ', '\n'],
      provideCompletionItems: async (model, position) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const fullContent = model.getValue();
        const textBeforeCursor = lineContent.slice(0, position.column - 1);

        const { data } = await postCompletionsApiPyCompletionsPost({
          body: {
            line: lineContent,
            cursor_position: position.column - 1,
            full_content: fullContent,
            line_number: position.lineNumber - 1,
          },
        });

        const completions = data?.completions ?? [];

        if (data?.completions?.length === 0) {
          return { suggestions: [] };
        }

        const colonIndex = textBeforeCursor.lastIndexOf(':');
        const isValueCompletion =
          colonIndex !== -1 && data?.completions?.some((c) => c.kind === 'value');
        const range = isValueCompletion
          ? {
              startLineNumber: position.lineNumber,
              startColumn:
                colonIndex +
                2 +
                (textBeforeCursor.slice(colonIndex + 1).length -
                  textBeforeCursor.slice(colonIndex + 1).trimStart().length),
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            }
          : {
              startLineNumber: position.lineNumber,
              startColumn: model.getWordUntilPosition(position).startColumn,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            };

        return {
          suggestions:
            completions.map((c, i) => ({
              label: c.label,
              kind:
                c.kind === 'property'
                  ? monaco.languages.CompletionItemKind.Property
                  : monaco.languages.CompletionItemKind.Value,
              detail: c.detail ?? undefined,
              documentation: c.documentation ?? undefined,
              insertText: c.insertText,
              range,
              sortText: String(i).padStart(3, '0'),
            })) ?? [],
        };
      },
    });
  };

  const handleChange: OnChange = useCallback(
    (newValue) => {
      if (newValue !== undefined && newValue !== valueRef.current) {
        valueRef.current = newValue;
        onChange(newValue);
      }
    },
    [onChange]
  );

  return (
    <Card className="border-border bg-card flex h-full flex-col overflow-hidden shadow-sm">
      <CardHeader className="border-border flex flex-row items-center justify-between space-y-0 border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-lg p-2">
            <FileCode2 className="text-primary h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">YAML Editor</CardTitle>
            <p className="text-muted-foreground mt-0.5 font-mono text-xs">config.yaml</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative min-h-0 flex-1 p-0">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          defaultValue={value}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          theme="yaml-light"
          options={{
            fontSize: 14,
            lineHeight: 24,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            padding: { top: 16, bottom: 16 },
            suggestOnTriggerCharacters: true,
            quickSuggestions: { other: true, comments: false, strings: true },
            wordBasedSuggestions: 'off',
            acceptSuggestionOnEnter: 'on',
          }}
          loading={
            <div className="flex h-full items-center justify-center">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
            </div>
          }
        />
      </CardContent>

      {parseError && (
        <div className="bg-destructive/10 border-destructive/30 text-destructive flex items-center gap-2 border-t px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="font-mono text-xs">{parseError}</span>
        </div>
      )}
    </Card>
  );
}
