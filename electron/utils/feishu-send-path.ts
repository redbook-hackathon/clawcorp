export type FeishuDirectSendResult = {
  transport: 'direct';
  messageId: string;
  chatId: string;
};

export type FeishuRuntimeSendResult = {
  transport: 'runtime';
  sessionKey: string;
  runId?: string;
};

export type FeishuSendPathResult = FeishuDirectSendResult | FeishuRuntimeSendResult;

export async function sendFeishuViaPreferredPath(params: {
  directSend?: () => Promise<{ messageId: string; chatId: string }>;
  runtimeSend?: () => Promise<{ sessionKey: string; runId?: string }>;
}): Promise<FeishuSendPathResult> {
  const { directSend, runtimeSend } = params;

  if (!directSend && !runtimeSend) {
    throw new Error('No Feishu send path is available');
  }

  if (directSend) {
    try {
      const result = await directSend();
      return {
        transport: 'direct',
        messageId: result.messageId,
        chatId: result.chatId,
      };
    } catch (directError) {
      if (!runtimeSend) {
        throw directError;
      }
    }
  }

  if (!runtimeSend) {
    throw new Error('No Feishu runtime send path is available');
  }

  const runtimeResult = await runtimeSend();
  return {
    transport: 'runtime',
    sessionKey: runtimeResult.sessionKey,
    ...(runtimeResult.runId ? { runId: runtimeResult.runId } : {}),
  };
}
