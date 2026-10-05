import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/shared/EmptyState'
import { Image, X } from 'lucide-react'
import { formatDate, getTodayISO } from '@/lib/utils'
import type { Photo } from '@/types'

export default function PhotosGallery() {
  const [dateFilter, setDateFilter] = useState(getTodayISO())
  const [preview, setPreview] = useState<Photo | null>(null)

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['admin-photos', dateFilter],
    queryFn: async () => {
      let q = supabase
        .from('photos')
        .select('*, agent:profiles!agent_id(full_name), outlet:outlets(name)')
        .order('created_at', { ascending: false })
        .limit(60)

      if (dateFilter) {
        q = q.gte('created_at', `${dateFilter}T00:00:00`).lte('created_at', `${dateFilter}T23:59:59`)
      }

      const { data, error } = await q
      if (error) throw error

      const withUrls = await Promise.all(
        (data as Photo[]).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from('outlet-photos')
            .createSignedUrl(p.storage_path, 3600)
          return { ...p, signed_url: signed?.signedUrl }
        })
      )
      return withUrls
    },
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Photos Gallery</h1>
          <p className="text-sm text-slate-500">{photos.length} photos</p>
        </div>
        <input
          type="date"
          className="input w-auto"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <EmptyState icon={Image} title="No photos" description="Photos uploaded by agents will appear here." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {photos.map((p) => (
            <button
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100"
              onClick={() => setPreview(p)}
            >
              {p.signed_url ? (
                <img
                  src={p.signed_url}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <Image className="h-8 w-8" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate text-xs text-white">
                  {(p as Photo & { agent?: { full_name: string } }).agent?.full_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setPreview(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <div className="max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {preview.signed_url && (
              <img
                src={preview.signed_url}
                alt=""
                className="max-h-[80vh] rounded-lg object-contain"
              />
            )}
            <div className="mt-3 text-center text-sm text-white">
              <p>
                {(preview as Photo & { agent?: { full_name: string } }).agent?.full_name} ·{' '}
                {(preview as Photo & { outlet?: { name: string } }).outlet?.name}
              </p>
              <p className="text-white/60">{formatDate(preview.created_at, 'datetime')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
