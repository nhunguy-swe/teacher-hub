"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "contacts"), {
        ...formData,
        createdAt: serverTimestamp(),
      });
      alert("Đã gửi lời nhắn thành công!");
      setFormData({ name: "", phone: "", message: "" });
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra, vui lòng thử lại.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-4 border border-slate-700 rounded-xl bg-slate-800"
    >
      <input
        className="w-full p-2 bg-slate-900 border rounded"
        placeholder="Họ tên phụ huynh"
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        value={formData.name}
        required
      />
      <input
        className="w-full p-2 bg-slate-900 border rounded"
        placeholder="Số điện thoại"
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        value={formData.phone}
        required
      />
      <textarea
        className="w-full p-2 bg-slate-900 border rounded"
        placeholder="Nội dung lời nhắn"
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        value={formData.message}
        required
      />
      <button
        type="submit"
        className="w-full bg-emerald-600 p-2 rounded text-white font-bold"
      >
        Gửi lời nhắn
      </button>
    </form>
  );
}
