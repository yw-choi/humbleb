"use client";

import { useEffect, useState } from "react";
import { getMembers, linkMember, type Member, APIError } from "@/lib/api";
import { showToast } from "./Toast";

interface MemberPickerProps {
  onLinked: () => void;
}

export function MemberPicker({ onLinked }: MemberPickerProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    getMembers()
      .then(setMembers)
      .catch(() => showToast("멤버 목록을 불러올 수 없습니다", "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (member: Member) => {
    setLinking(true);
    try {
      await linkMember(member.id);
      showToast(`${member.name}님으로 연결되었습니다`);
      onLinked();
    } catch (e) {
      if (e instanceof APIError) {
        showToast(e.message, "error");
      }
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <div className="text-gray-400">로딩중...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-2 text-xl font-bold">본인 확인</h1>
      <p className="mb-6 text-sm text-gray-500">
        아래 목록에서 본인 이름을 선택해주세요 (최초 1회)
      </p>
      <div className="flex flex-col gap-1">
        {members.map((member) => (
          <button
            key={member.id}
            onClick={() => handleSelect(member)}
            disabled={linking}
            className="flex h-14 items-center rounded-lg px-4 text-left text-base active:bg-gray-100 disabled:opacity-50"
          >
            <span className="flex-1 font-medium">{member.name}</span>
            <span className="text-sm text-gray-400">
              {member.gender === "M" ? "남" : "여"} · NTRP {member.ntrp}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
