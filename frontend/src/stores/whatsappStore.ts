import { create } from 'zustand'
import type { WhatsappConversation, WhatsappMessage } from '@/types'

interface WhatsappState {
  conversations: Map<string, WhatsappConversation>
  activeConversationId: string | null
  messages: Map<string, WhatsappMessage[]>
  aiSuggestions: Map<string, string>

  setConversations: (conversations: WhatsappConversation[]) => void
  updateConversation: (conversation: WhatsappConversation) => void
  setActiveConversation: (id: string | null) => void
  addMessage: (conversationId: string, message: WhatsappMessage) => void
  setMessages: (conversationId: string, messages: WhatsappMessage[]) => void
  setAiSuggestion: (conversationId: string, suggestion: string) => void
  clearAiSuggestion: (conversationId: string) => void
  incrementUnread: (conversationId: string) => void
  markAsRead: (conversationId: string) => void
}

export const useWhatsappStore = create<WhatsappState>((set, get) => ({
  conversations: new Map(),
  activeConversationId: null,
  messages: new Map(),
  aiSuggestions: new Map(),

  setConversations: (conversations) => {
    const map = new Map(conversations.map((c) => [c.id, c]))
    set({ conversations: map })
  },

  updateConversation: (conversation) => {
    const conversations = new Map(get().conversations)
    conversations.set(conversation.id, conversation)
    set({ conversations })
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) => {
    const messages = new Map(get().messages)
    const existing = messages.get(conversationId) ?? []
    const deduped = existing.filter((m) => m.id !== message.id)
    messages.set(conversationId, [...deduped, message])
    set({ messages })
  },

  setMessages: (conversationId, messages) => {
    const map = new Map(get().messages)
    map.set(conversationId, messages)
    set({ messages: map })
  },

  setAiSuggestion: (conversationId, suggestion) => {
    const suggestions = new Map(get().aiSuggestions)
    suggestions.set(conversationId, suggestion)
    set({ aiSuggestions: suggestions })
  },

  clearAiSuggestion: (conversationId) => {
    const suggestions = new Map(get().aiSuggestions)
    suggestions.delete(conversationId)
    set({ aiSuggestions: suggestions })
  },

  incrementUnread: (conversationId) => {
    const conversations = new Map(get().conversations)
    const conv = conversations.get(conversationId)
    if (conv) {
      conversations.set(conversationId, { ...conv, unreadCount: conv.unreadCount + 1 })
      set({ conversations })
    }
  },

  markAsRead: (conversationId) => {
    const conversations = new Map(get().conversations)
    const conv = conversations.get(conversationId)
    if (conv) {
      conversations.set(conversationId, { ...conv, unreadCount: 0 })
      set({ conversations })
    }
  },
}))
