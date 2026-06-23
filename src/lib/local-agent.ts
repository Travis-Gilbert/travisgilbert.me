'use client';

import { isTauri, modelChat } from '@/lib/desktop';
import { gqlAsk, type AskResultGql } from '@/lib/commonplace-graphql';

export type LocalAgentProtocol = 'openai' | 'ollama';

export interface LocalAgentSettings {
  enabled: boolean;
  protocol: LocalAgentProtocol;
  endpoint: string;
  model: string;
}

const STORAGE_KEY = 'commonplace.localAgentSettings.v1';

export const DEFAULT_LOCAL_AGENT_SETTINGS: LocalAgentSettings = {
  enabled: true,
  protocol: 'openai',
  endpoint: 'http://127.0.0.1:8080/v1/chat/completions',
  model: 'gemma3:latest',
};

export function readLocalAgentSettings(): LocalAgentSettings {
  if (typeof window === 'undefined') return DEFAULT_LOCAL_AGENT_SETTINGS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_LOCAL_AGENT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalAgentSettings>;
    return {
      ...DEFAULT_LOCAL_AGENT_SETTINGS,
      ...parsed,
      protocol: parsed.protocol === 'ollama' ? 'ollama' : 'openai',
    };
  } catch {
    return DEFAULT_LOCAL_AGENT_SETTINGS;
  }
}

export function writeLocalAgentSettings(settings: LocalAgentSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function askCommonPlaceAgent(question: string, k = 8): Promise<AskResultGql> {
  const graphAnswer = await gqlAsk(question, k).catch(() => ({
    answer: '',
    answerKind: 'EMPTY' as const,
    provenance: [],
  }));

  if (!isTauri()) return graphAnswer;

  const settings = readLocalAgentSettings();
  if (!settings.enabled) return graphAnswer;

  const context = graphAnswer.provenance
    .slice(0, k)
    .map((p, index) => {
      const body = p.item.bodyText?.trim();
      return `${index + 1}. ${p.item.title}${body ? `\n${body.slice(0, 1200)}` : ''}`;
    })
    .join('\n\n');

  try {
    const result = await modelChat({
      model: 'local',
      localProtocol: settings.protocol,
      localEndpoint: settings.endpoint,
      localModel: settings.model,
      messages: [
        {
          role: 'system',
          content:
            'You are the local CommonPlace agent running on this desktop. Answer from the CommonPlace context when it is useful, and say when the context is thin.',
        },
        {
          role: 'user',
          content: context
            ? `Question:\n${question}\n\nCommonPlace context:\n${context}`
            : question,
        },
      ],
    });
    return {
      answer: result.content,
      answerKind: 'MODEL',
      provenance: graphAnswer.provenance,
    };
  } catch (error) {
    if (graphAnswer.answer.trim() || graphAnswer.provenance.length > 0) {
      return graphAnswer;
    }
    return {
      answer: `Local agent unavailable: ${String(error)}`,
      answerKind: 'EMPTY',
      provenance: [],
    };
  }
}
