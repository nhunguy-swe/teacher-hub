"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PinAdminModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  // Mã PIN bí mật của bạn (có thể đổi tùy ý)
  const SECRET_PIN = "010519"; 

  // Lắng nghe sự kiện mở modal từ bất kỳ đâu trong app (ví dụ từ Footer)
  useEffect(() => {
    const handleOpenModal = () => setIsOpen(true);
    window.addEventListener("open-admin-pin", handleOpenModal);
    return () => {
      window.removeEventListener("open-admin-pin", handleOpenModal);
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === SECRET_PIN) {
      setIsOpen(false);
      setPin("");
      setError(false);
      router.push("/admin");
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <>
      {/* Hộp thoại Popup nhập PIN */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-xs shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-center text-gray-800">Xác thực Admin</h3>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Nhập mã PIN"
                className="w-full px-4 py-2 border rounded-lg text-center tracking-widest text-lg outline-none focus:border-blue-500 text-black"
                autoFocus
              />
              {error && (
                <p className="text-red-500 text-sm text-center">Mã PIN không đúng!</p>
              )}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); setPin(""); setError(false); }}
                  className="w-1/2 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-blue-600 text-white rounded-lg font-medium"
                >
                  Vào
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}