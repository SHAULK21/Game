import { useEffect, useRef } from 'react';
/** Follow new messages only while the reader stays near the bottom. Never focus input. */
export function useChatScroll(messages: readonly unknown[]) {
  const streamRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  useEffect(() => {
    const stream = streamRef.current;
    if (stream && followLatest.current) stream.scrollTop = stream.scrollHeight;
  }, [messages]);
  const onStreamScroll = () => {
    const stream = streamRef.current;
    if (stream) followLatest.current = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 64;
  };
  return { streamRef, onStreamScroll };
}
