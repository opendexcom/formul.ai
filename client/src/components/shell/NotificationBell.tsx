import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

type NotificationItem = {
  _id: string;
  title: string;
  body: string;
  href?: string;
  readAt?: string;
  createdAt: string;
};

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ items: NotificationItem[]; unreadCount: number }>(
        '/notifications',
      );
      setItems(response.data.items);
      setUnreadCount(response.data.unreadCount);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setOpen((value) => !value);
    if (!open) void loadNotifications();
  };

  const openNotification = async (item: NotificationItem) => {
    if (!item.readAt) {
      await apiClient.patch(`/notifications/${item._id}/read`).catch(() => undefined);
    }
    setOpen(false);
    if (item.href) navigate(item.href);
    void loadNotifications();
  };

  const markAllRead = async () => {
    await apiClient.post('/notifications/read-all').catch(() => undefined);
    void loadNotifications();
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Mark all read
              </button>
            )}
          </div>
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">Loading…</p>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-gray-900">No notifications yet</p>
              <p className="mt-1 text-xs text-gray-500">
                Analysis complete, quota alerts, and report updates will appear here.
              </p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => void openNotification(item)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${
                      item.readAt ? 'opacity-70' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-gray-600">{item.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
