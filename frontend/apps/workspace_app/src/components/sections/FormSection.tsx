import { memo, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Send } from 'lucide-react'
import { byOrder } from '@/utils/collection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Reveal } from '@/components/shared/Reveal'
import type { FormField, FormSection as FormSectionConfig } from '@/types/config'

const FieldControl = memo(function FieldControl({ field }: { field: FormField }) {
  const common = {
    id: field.id,
    name: field.name,
    placeholder: field.placeholder,
    required: field.required,
  }

  switch (field.type) {
    case 'textarea':
      return <Textarea {...common} rows={4} />
    case 'select':
      return (
        <Select {...common} defaultValue="">
          <option value="" disabled>
            {field.placeholder ?? 'Select an option'}
          </option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )
    default:
      return <Input {...common} type={field.type} />
  }
})

function FormSectionComponent({ section }: { section: FormSectionConfig }) {
  const [submitted, setSubmitted] = useState(false)
  const fields = useMemo(() => byOrder(section.fields), [section.fields])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <section id={section.id} className="section-padding scroll-mt-16 bg-muted/30">
      <div className="container max-w-xl">
        <SectionHeading heading={section.heading} />
        <Reveal>
          {submitted ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-10 text-center shadow-sm">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-medium">{section.successMessage}</p>
              <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                Send another message
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-5 rounded-2xl border bg-card p-8 shadow-sm"
            >
              {fields.map((field) => (
                <div key={field.id} className="flex flex-col gap-2">
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="ml-0.5 text-destructive">*</span>}
                  </Label>
                  <FieldControl field={field} />
                </div>
              ))}
              <Button type="submit" size="lg" variant="gradient" className="mt-2">
                <Send /> {section.submitLabel}
              </Button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  )
}

export default memo(FormSectionComponent)
