import { cn } from '@/lib/utils'
import i18n from '@/services/i18n'
import { THUMB_SIZE } from '@/utils/consts'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  thumb: string
  name: string
  description: string
  caps: string
  link: string
  isHuge?: boolean
  showTitle?:boolean
}

const Card: React.FC<CardProps> = ({
  thumb,
  name,
  caps,
  link,
  isHuge,
  showTitle,
  ...props
}) => {

  return (
    <div
      {...props}
      className="relative group p-0"
      style={{
        width: `${THUMB_SIZE.W * (isHuge ? 3 : 1)}px`,
        height: `${THUMB_SIZE.H * (isHuge ? 3 : 1)}px`,
      }}
    >
      <Link href={link}>
        <Image
          src={thumb}
          alt={name}
          className="object-cover transition-transform duration-300 group-hover:scale-110"
          layout="fill"
        />
        <div className={cn("absolute bottom-2 left-[-5%] w-[110.5%] m-0 flex flex-col justify-center items-center bg-slate-700 transition-opacity duration-300 opacity-0 group-hover:opacity-90",showTitle&&"opacity-100")}>
          <label className="text-white capitalize text-center px-1">{name.replaceAll("-", " ")}</label>
          <span className="text-white">{caps}</span>
        </div>
      </Link>
    </div>
  )
}

export const asCard = (
  Component: React.JSXElementConstructor<any>,
  name: string,
  link: string = ''
) => {

  return (
    <Link href={link}>
      <div
        className="relative group p-0 flex items-center justify-center"
        style={{
          width: `100%`,
          height: `${THUMB_SIZE.H}px`,
        }}
      >
        {<Component size={50} />}
        <div className="absolute bottom-5 left-[-5%] w-[110.5%] m-0 flex flex-col justify-center items-center  transition-opacity duration-300 opacity-0 group-hover:opacity-90">
          <label className="text-white">{name ? i18n(name) : ''}</label>
        </div>
      </div>
    </Link>
  )
}

export default Card
