import { site } from '@/config'

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/brand/mark-darkgreen.svg" alt="" width={26} height={26} className="size-[26px]" />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-bone">{site.name}</span>
    </span>
  )
}
