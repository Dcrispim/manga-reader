"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import Card from "@/components/Card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft } from "lucide-react";

const TitlePage = () => {
  const router = useRouter();
  const params = useParams();
  const title = params?.title;
  const [chapters, setChapters] = useState<string[]>([]);
  const [lastChapter, setLastChapter] = useState<string | null>(null);
  const [currentChapter, setCurrentChapter] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 100
  const totalPages = Math.ceil(chapters.length / ITEMS_PER_PAGE)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentChapters, setCurrentChapters] = useState<string[]>([])
  const [goToPage, setGoToPage] = useState('') // Para o input opcional

  useEffect(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    setCurrentChapters(chapters.slice(startIndex, endIndex))
  }, [currentPage, chapters])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  const handleSliderChange = (value: number[]) => {
    handlePageChange(value[0])
  }

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const pageNum = parseInt(goToPage)
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum)
    }
    setGoToPage('')
  }


  useEffect(() => {
    if (title) {
      const storedChapters = JSON.parse(localStorage.getItem("chapters") || "{}");
      setLastChapter(storedChapters[title as string] || null);
      setCurrentChapter(storedChapters[title as string] || null)
      fetch(`/api/read/${title}`)
        .then((response) => response.json())
        .then((data) => setChapters(data.chapters))
        .catch((error) => console.error("Error fetching chapters:", error));
    }
  }, [title]);

  return (<div className="flex">
    {currentChapter && (
      <div className="relative w-fit max-w-xs h-screen flex flex-col justify-between">

        <div className="flex flex-col">
          <Button
            onClick={() => router.push(`/read/${title}/${currentChapter}`)}
            variant="outline"
            className="bottom-3 left-3 bg-white hover:bg-opacity-100 transition text-black font-semibold px-4 py-2 rounded-md shadow-md w-10"
          >
            Continue Last Chapter: {currentChapter}
          </Button>
          <div className="w-full h-auto right-3 grid grid-cols-3 gap-1">
            {[3, 4, 5].map((index) => (
              <div
                key={index}
                className="w-full h-full max-h-50 bg-gray-300 rounded-sm overflow-hidden"
              >
                <Image
                  src={`/api/read/${title}/${currentChapter}/${index}`}
                  alt={`Mosaic thumbnail ${index + 1}`}
                  className="object-cover w-full h-full"
                  width={60}
                  height={60}
                />

              </div>

            ))}
          </div>
          
        </div>
        <div>
          <Image
            src={`/api/read/${title}/${currentChapter}/0`}
            alt={`Thumbnail of chapter ${currentChapter}`}
            className="h-fit object-cover rounded-lg shadow-lg"
            width={400}

            height={600}
          //style={{ height: "100%", objectFit: "cover" }}
          />
        </div>
        <Button
          onClick={() => router.push(`/`)}
          variant="outline"
          className="bottom-3 left-3 hover:bg-opacity-100 transition font-semibold px-4 py-2 rounded-md shadow-md w-10"
        >
          <ArrowLeft />Inicio
        </Button>
      </div>
    )}

    <div className="flex flex-col items-center w-full h-screen p-6 space-y-6 pb-16">
      <h1 className="text-3xl font-bold capitalize">{title}</h1>

      {/* Grid de capítulos */}
      <div className="w-full grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 h-[70%] p-4 overflow-y-auto border border-gray-200 rounded-lg shadow-md">
        {currentChapters?.map((chapter) => (
          <div key={chapter} onClick={() => {
            if (chapter === currentChapter) {
              router.push(`/read/${title}/${chapter}`)
            }
            setCurrentChapter(chapter)

          }}>
            <Card
              caps={chapter}
              link={``}

              name={title as string}
              thumb={`/api/read/${title}/${chapter}/0`}
              description=""
              showTitle
            />
          </div>
        ))}
      </div>

      {/* Controles de paginação com shadcn */}
      <div className="flex flex-col items-center w-full space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>

          <span className="text-lg font-medium">
            Volume {currentPage} de {totalPages}
          </span>

          <Button
            variant="outline"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Próximo
          </Button>
        </div>

        {/* Slider do shadcn */}
        <div className="w-full px-4 space-y-2">
          <Slider
            min={1}
            max={totalPages}
            value={[currentPage]}
            onValueChange={handleSliderChange}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>1</span>
            <span>{totalPages}</span>
          </div>
        </div>

        {/* Input opcional para pular para página */}
        <form onSubmit={handleInputSubmit} className="flex gap-2">
          <Input
            type="number"
            placeholder={`Pular para volume (1-${totalPages})`}
            value={goToPage}
            onChange={(e) => setGoToPage(e.target.value)}
            min={1}
            max={totalPages}
            className="w-48"
          />
          <Button type="submit" variant="secondary">
            Ir
          </Button>
        </form>
      </div>
    </div>
  </div>
  );
};

export default TitlePage;
