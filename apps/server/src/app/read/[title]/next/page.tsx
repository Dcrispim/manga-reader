'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getNextChapter } from '@/utils/utils.server';
import { getHistory, TitleHistory } from '@/utils/history';

export default function LastChapterPage() {
    const router = useRouter();
    const { title } = useParams<{title:string}>();

    useEffect(() => {
        const chapter = JSON.parse(localStorage.getItem('chapters') || '{}');
        const titleHistory = getHistory()[title];
        console.log({chapter,hist:titleHistory});
        
        const lastChapter = chapter[title as string] || '1'; // Default to the first chapter if empty
        const nextChapter = getNextChapter(lastChapter, titleHistory.history.map((c:string) => parseFloat(c)))
        router.push(`/read/${title}/${nextChapter}`);

        
    }, [router, title]);

    return <>
    </> // No UI, just redirection
}
