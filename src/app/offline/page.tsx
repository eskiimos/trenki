'use client';

import { Button } from '@/components/ui';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-8">
          <svg
            className="mx-auto h-24 w-24 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-4">
          Нет подключения к интернету
        </h1>
        
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Проверьте подключение к интернету и попробуйте снова
        </p>
        
        <Button variant="primary" onClick={() => window.location.reload()}>
          Обновить страницу
        </Button>
      </div>
    </div>
  );
}
