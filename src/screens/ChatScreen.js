import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { getMessages, sendMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ChatScreen({ route }) {
  const { user } = useAuth();
  const withUserId = route.params?.withUserId;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    if (!user?._id || !withUserId) {
      setLoading(false);
      return;
    }
    try {
      const res = await getMessages(user._id, withUserId);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [user, withUserId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSend = async () => {
    if (!text.trim() || !withUserId || !user?._id) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      const res = await sendMessage(user._id, withUserId, body);
      setMessages((prev) => [...prev, res.data]);
    } catch (err) {
      setText(body); // restore on failure
    } finally {
      setSending(false);
    }
  };

  if (!withUserId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No recipient selected.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1A6B5A" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m, i) => m._id || String(i)}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.senderId === user?._id;
            return (
              <View
                style={[
                  styles.bubble,
                  mine ? styles.bubbleOut : styles.bubbleIn,
                ]}
              >
                <Text style={mine ? styles.textOut : styles.textIn}>
                  {item.text}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Say hello to start the chat.</Text>
          }
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#94A3B8"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleSend}
          disabled={sending || !text.trim()}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messages: { padding: 12, flexGrow: 1 },
  bubble: {
    maxWidth: '78%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  bubbleIn: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 3,
  },
  bubbleOut: {
    backgroundColor: '#1A6B5A',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 3,
  },
  textIn: { color: '#1A1A2E', fontSize: 13 },
  textOut: { color: '#fff', fontSize: 13 },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F4F6F8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1A1A2E',
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#1A6B5A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
