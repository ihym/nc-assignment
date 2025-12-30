'use client';

import { YamlEditor } from './components/YamlEditor';
import { ConfigForm } from './components/ConfigForm';
import { useConfig } from './hooks/useConfig';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function Home() {
  const { config, yamlContent, isLoading, error, updateFromYaml, updateFromForm, parseError } =
    useConfig();

  if (isLoading || !config) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="border-secondary h-16 w-16 animate-pulse rounded-full border-4" />
            <Loader2 className="text-primary absolute top-1/2 left-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin" />
          </div>
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="bg-background flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-border bg-card sticky top-0 z-50 border-b shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-500/20">
                  <svg
                    className="h-6 w-6 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <path d="M12 18v-6" />
                    <path d="M9 15l3 3 3-3" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-foreground text-xl font-bold">YAML Config Editor</h1>
                  <p className="text-muted-foreground text-xs">Web server configuration manager</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3">
          <div className="container mx-auto flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto flex-1 p-6">
        <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-6 lg:grid-cols-2">
          {/* YAML Editor Panel */}
          <div className="min-h-[400px] lg:min-h-0">
            <YamlEditor value={yamlContent} onChange={updateFromYaml} parseError={parseError} />
          </div>

          {/* Config Form Panel */}
          <div className="min-h-[400px] lg:min-h-0">
            <ConfigForm config={config} onChange={updateFromForm} />
          </div>
        </div>
      </div>
    </main>
  );
}
