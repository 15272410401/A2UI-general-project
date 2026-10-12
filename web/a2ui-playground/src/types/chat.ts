export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
  images?: string[];
};

export type ChatSendPayload = {
  text: string;
  images: string[];
};
