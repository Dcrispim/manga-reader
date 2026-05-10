"use client"
import { useEffect, useState, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import i18n from '@/services/i18n'
import { cn } from '@/lib/utils'
import { getHistory, TitleHistory } from '@/utils/history'

export default function GridView({ chapters, title, chapter }: { chapters: string[], title: string, chapter: string }) {
    const [gridView, setGridView] = useState<'chapters' | 'volume'>('chapters')
    const [selectedVolume, setSelectedVolume] = useState<number | null>(null)
    const [tabGrid, setTabGrid] = useState<number | null>(null)
    const currentChapterRef = useRef<HTMLDivElement | null>(null)
    const [{ lastRead, history: lastChapters }, setHistory] = useState<TitleHistory>({
        lastRead: null,
        history: []
    })


    const handleVolumeClick = (volume: number) => {
        setSelectedVolume(Math.floor(volume))
    }
    useEffect(() => {
        if (gridView === "volume") {
            setSelectedVolume(null)
        }
    }, [gridView])

    useEffect(() => {
        if (currentChapterRef.current) {
            currentChapterRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [chapter])

    useEffect(() => {
        let localHistory: TitleHistory = {
            lastRead: null,
            history: []
        }
        try {
            const allHistory = getHistory()
            localHistory = allHistory[title]

            
        } catch (error) {
            return
        }

        setHistory(localHistory)
    }, [chapter, title])
    return (
        <div className='flex-col w-full'>
            <div className="flex flex-row items-center justify-around w-full py-4">
                <label>
                    <input
                        type="radio"
                        name="viewMode"
                        value="chapters"
                        checked={gridView === 'chapters'}
                        onChange={() => {
                            setGridView('chapters')
                            setSelectedVolume(null)
                        }}
                    />
                    {i18n('Chapters')}
                </label>
                <label onClick={() => {
                    setSelectedVolume(null)
                }}>
                    <input
                        type="radio"
                        name="viewMode"
                        value="volume"
                        checked={gridView === 'volume'}
                        onChange={() => {

                            setGridView('volume')
                        }}
                    />
                    {i18n('Volume')}
                </label>
            </div>
            {gridView === 'chapters' || selectedVolume !== null ? (
                <div
                    id="chapters-grid"
                    className="grid grid-cols-[repeat(auto-fit,_minmax(3rem,_1fr))] gap-3 w-full px-5 h-96 overflow-y-scroll"
                >
                    {(selectedVolume ? chapters.filter((chap, index) => parseFloat(chap) >= selectedVolume * 100 && parseFloat(chap) < (selectedVolume + 1) * 100) : chapters).map((chap: string) => (
                        <Link key={chap} href={`/read/${title}/${chap}`}>
                            <div
                                ref={chap === chapter ? currentChapterRef : null}
                            >
                                <Button
                                    variant={'outline'}
                                    className={cn(
                                        'hover:bg-slate-300 hover:text-slate-800 transition',
                                        chap === chapter && "bg-slate-300 text-slate-800"
                                    )}
                                    style={{
                                        backgroundColor: lastChapters && chap !== chapter && lastChapters.indexOf(chap) !== -1
                                            ? `rgb(${203 - 30 * lastChapters.length - lastChapters.indexOf(chap) - 1}, ${213 - 30 * lastChapters.length - lastChapters.indexOf(chap) - 1}, ${225 - 30 * lastChapters.length - lastChapters.indexOf(chap) - 1})`
                                            : undefined
                                    }}
                                >
                                    {parseFloat(chap)}
                                </Button>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div
                    id="volumes-grid"
                    className="grid grid-cols-[repeat(auto-fit,_minmax(4rem,_1fr))] gap-3 w-full px-5 h-96 overflow-y-scroll"
                >
                    {Array.from({ length: Math.floor(chapters.length / 100) }, (_, i) => (
                        <div key={i}>
                            <Button variant={'outline'} onClick={() => handleVolumeClick(i)} className='hover:bg-slate-300 hover:text-slate-800 transition' >
                                {i18n(`Vol. ${i}`)}
                            </Button>
                        </div>
                    ))}

                </div>
            )}

            {lastChapters && lastChapters.length > 0 && (
                <div className="mt-4 px-5">
                    <h3 className="text-lg font-semibold">{i18n('Last Read Chapters')}</h3>
                    <div className="flex flex-col-reverse gap-2">
                        {lastChapters.map((chap) => (
                            chap !== chapter && <div key={chap}>
                                <Link href={`/read/${title}/${chap}`} className="text-blue-500 hover:underline">
                                    {i18n(`Chapter ${parseFloat(chap)}`)}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
