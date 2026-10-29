import { Capabilities } from '@/sections/Capabilities'
import { Faq } from '@/sections/Faq'
import { FinalCta } from '@/sections/FinalCta'
import { Hero } from '@/sections/Hero'
import { Pillars } from '@/sections/Pillars'
import { Product } from '@/sections/Product'
import { Providers } from '@/sections/Providers'
import { Security } from '@/sections/Security'

export function Home() {
  return (
    <>
      <Hero />
      <Providers />
      <Pillars />
      <Product />
      <Capabilities />
      <Security />
      <Faq />
      <FinalCta />
    </>
  )
}
