"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import AdminContact from "@/components/admin/AdminContact";
import { useToast } from "@/components/ToastProvider"

interface ItemData {
  id: string;
  [key: string]: unknown;
}

export default function ContactPage() {
    const toast = useToast();
  const [messages, setMessages] = useState<ItemData[]>([]);

  const loadMessages = useCallback(async () => {
    try {
      const q = query(collection(db, "contacts"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Lỗi khi tải lời nhắn:", err);
      toast.error("Lỗi khi tải lời nhắn");
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMessages();
  }, [loadMessages]);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "resolved" ? "pending" : "resolved";
    try {
      await updateDoc(doc(db, "contacts", id), { status: newStatus });
      loadMessages();
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái:", err);
      toast.error("Không thể cập nhật trạng thái!");
    }
  };

  const handleDelete = async (colName: string, id: string) => {
    try {
      await deleteDoc(doc(db, colName, id));
      loadMessages();
    } catch {
      toast.error("Xóa thất bại!");
    }
  };

  return (
    <AdminContact
      messages={messages}
      onToggleStatus={handleToggleStatus}
      onDelete={handleDelete}
    />
  );
}