import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications', { credentials: 'same-origin' });
      if (res.status === 401) {
        setNotifications([]);
        return;
      }
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await res.json();
          setNotifications(data);
        }
      }
    } catch (err) {
      // Polling is best-effort; keep the UI quiet during transient network changes.
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST', credentials: 'same-origin' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      }
    } catch (err) {
      // Read state will retry on the next refresh.
    }
  };

  const clearNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { method: 'DELETE', credentials: 'same-origin' });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (err) {
      // The next poll will reconcile if clearing fails transiently.
    }
  };

  const clearAllNotifications = async () => {
    if (user?.role !== 'admin') return;
    try {
      const res = await fetch('/api/admin/notifications', { method: 'DELETE', credentials: 'same-origin' });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (err) {
      // Admin can retry from the dropdown if the request fails transiently.
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, fetchNotifications, markAsRead, clearNotifications, clearAllNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
