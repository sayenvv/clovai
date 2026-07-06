import { memo } from 'react'
import { cn } from '@/utils/cn'
import { Label } from '@/components/ui/label'
import { COLOR_PRESETS, normalizeHexColor } from './diagram-colors'

interface ColorPaletteFieldProps {
  label: string
  value: string | undefined
  defaultValue: string
  onChange: (value: string | undefined) => void
}

/** Swatch grid + native color picker for diagram fill/border styling. */
export const ColorPaletteField = memo(function ColorPaletteField({
  label,
  value,
  defaultValue,
  onChange,
}: ColorPaletteFieldProps) {
  const active = value ?? defaultValue
  const isCustom = value !== undefined && !COLOR_PRESETS.includes(value as (typeof COLOR_PRESETS)[number])

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            title={preset}
            aria-label={`${label} ${preset}`}
            onClick={() => onChange(preset === defaultValue ? undefined : preset)}
            className={cn(
              'h-6 w-6 rounded-md border border-border shadow-sm transition-transform hover:scale-110',
              active === preset && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            )}
            style={{ backgroundColor: preset }}
          />
        ))}
        <label
          className={cn(
            'relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-border',
            isCustom && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          )}
          title="Custom color"
        >
          <span className="text-[9px] font-medium text-muted-foreground">+</span>
          <input
            type="color"
            value={active}
            onChange={(event) => {
              const next = normalizeHexColor(event.target.value)
              onChange(next === defaultValue ? undefined : next)
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={`Custom ${label.toLowerCase()}`}
          />
        </label>
      </div>
    </div>
  )
})
