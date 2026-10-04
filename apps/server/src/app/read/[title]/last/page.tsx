'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LastChapterPage({ params }: { params: { title: string } }) {
    const router = useRouter();
    const { title } = params;

    useEffect(() => {
        const chapters = JSON.parse(localStorage.getItem('chapters') || '{}');
        const lastChapter = chapters[title] || '1'; // Default to the first chapter if empty
        router.push(`/read/${title}/${lastChapter}`);

        
    }, [router, title]);

    return <>
    </> // No UI, just redirection
}
