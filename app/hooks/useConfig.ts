'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import yaml from 'js-yaml';
import type { Config } from '@/app/api/types.gen';
import {
  getConfigApiPyConfigGetOptions,
  updateConfigApiPyConfigPostMutation,
} from '@/app/api/@tanstack/react-query.gen';

interface UseConfigReturn {
  config: Config | null;
  yamlContent: string;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSaved: Date | null;
  updateFromYaml: (yamlString: string) => void;
  updateFromForm: (newConfig: Config) => void;
  parseError: string | null;
}

export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<Config | null>(null);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial config from server using auto-generated query
  const { data, isLoading, error: queryError } = useQuery(getConfigApiPyConfigGetOptions());

  // Sync query data to local state
  useEffect(() => {
    if (data) {
      setConfig(data.config);
      setYamlContent(data.yaml_content);
    }
  }, [data]);

  // Mutation for saving config
  const mutation = useMutation({
    ...updateConfigApiPyConfigPostMutation(),
    onSuccess: () => {
      setLastSaved(new Date());
    },
  });

  // Save to backend with debounce
  const saveToBackend = useCallback(
    (yamlString: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        mutation.mutate({ body: { yaml_content: yamlString } });
      }, 800);
    },
    [mutation]
  );

  // Update from YAML editor
  const updateFromYaml = useCallback(
    (yamlString: string) => {
      setYamlContent(yamlString);
      setParseError(null);

      try {
        const parsed = yaml.load(yamlString) as Config;
        if (
          parsed?.server?.host &&
          typeof parsed.server.port === 'number' &&
          typeof parsed.server.use_ssl === 'boolean' &&
          parsed?.logging?.level &&
          parsed?.logging?.file
        ) {
          setConfig(parsed);
          saveToBackend(yamlString);
        } else {
          setParseError('Invalid configuration structure');
        }
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Invalid YAML');
      }
    },
    [saveToBackend]
  );

  // Update from form
  const updateFromForm = useCallback(
    (newConfig: Config) => {
      setConfig(newConfig);
      setParseError(null);
      const newYaml = yaml.dump(newConfig, { sortKeys: false });
      setYamlContent(newYaml);
      saveToBackend(newYaml);
    },
    [saveToBackend]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const error =
    queryError?.message ??
    (mutation.error?.detail?.[0]?.msg || (mutation.error ? 'Save failed' : null));

  return {
    config,
    yamlContent,
    isLoading,
    isSaving: mutation.isPending,
    error,
    lastSaved,
    updateFromYaml,
    updateFromForm,
    parseError,
  };
}
