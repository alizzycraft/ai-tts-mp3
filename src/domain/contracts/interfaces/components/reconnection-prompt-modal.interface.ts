export interface IReconnectionPromptModal {
  promptData: {
    previousPath: string;
    shouldPrompt: boolean;
  };
  reconnect(): Promise<void>;
  decline(): void;
}
