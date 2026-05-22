'use client';
import { useEffect, useCallback } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useQueryClient } from '@tanstack/react-query';
import type { SocketNewMessage } from '@/types';

export function useSocket() {
  const user = useAuthStore(s => s.user);
  const addNotification = useUIStore(s => s.addNotification);
  const queryClient = useQueryClient();

  const organizationId = user?.organizationId;

  const handleNewMessage = useCallback(
    (data: SocketNewMessage) => {
      // Invalidate contacts list and specific contact messages
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      void queryClient.invalidateQueries({ queryKey: ['messages', data.message.phone] });

      // Show notification for inbound messages
      if (data.message.direction === 'INBOUND') {
        addNotification('info', `New message from ${data.contact.name ?? data.message.phone}`);

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`💬 ${data.contact.name ?? data.message.phone}`, {
            body: data.message.content.slice(0, 100),
            icon: '/icon.png',
          });
        }
      }
    },
    [queryClient, addNotification]
  );

  useEffect(() => {
    if (!organizationId) return;

    const socket = connectSocket(organizationId);

    socket.on('new:message', handleNewMessage);

    socket.on('lead:hot', (data: { phone: string; name?: string; score: number }) => {
      addNotification('warning', `🔥 Hot lead! ${data.name ?? data.phone} (score: ${data.score})`);
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    });

    socket.on('contact:updated', () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    });

    socket.on('contact:deleted', () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    });

    socket.on('agent:escalated', (data: { phone: string; agentName: string }) => {
      addNotification('warning', `⚠️ Escalated to ${data.agentName}: ${data.phone}`);
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    });

    return () => {
      socket.off('new:message', handleNewMessage);
      socket.off('lead:hot');
      socket.off('contact:updated');
      socket.off('contact:deleted');
      socket.off('agent:escalated');
      disconnectSocket(organizationId);
    };
  }, [organizationId, handleNewMessage, addNotification, queryClient]);

  return getSocket();
}
