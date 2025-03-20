import { useState } from 'react';
import type { ProviderInfo } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useDeepResearch');

export function useDeepResearch() {
  const [isResearching, setIsResearching] = useState(false);
  const [researchComplete, setResearchComplete] = useState(false);

  const resetResearch = () => {
    setIsResearching(false);
    setResearchComplete(false);
  };

  const performResearch = async (
    input: string,
    setInput: (value: string) => void,
    model: string,
    provider: ProviderInfo,
    apiKeys?: Record<string, string>,
  ) => {
    setIsResearching(true);
    setResearchComplete(false);

    const requestBody: any = {
      message: input,
      model,
      provider,
    };

    if (apiKeys) {
      requestBody.apiKeys = apiKeys;
    }

    const response = await fetch('/api/deep-research', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const reader = response.body?.getReader();
    const originalInput = input;

    if (reader) {
      const decoder = new TextDecoder();
      let _input = '';
      let _error;

      try {
        setInput(''); // Clear input before streaming starts

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            break;
          }

          _input += decoder.decode(value);
          logger.trace('Research output', _input);
          setInput(_input);
        }
      } catch (error) {
        _error = error;
        setInput(originalInput); // Restore original input on error
      } finally {
        if (_error) {
          logger.error(_error);
        }

        setIsResearching(false);
        setResearchComplete(true);

        setTimeout(() => {
          setInput(_input);
        });
      }
    }
  };

  return {
    isResearching,
    researchComplete,
    performResearch,
    resetResearch,
  };
}
