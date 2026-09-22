import voxelScene from '@/assets/hero/voxel-scene.webp'

export function HeroScene() {
  return (
    <div className="arena-scene">
      <div className="arena-scene__grid" aria-hidden="true" />
      <img
        className="arena-scene__image"
        src={voxelScene}
        alt="Два участника ведут переговоры за столом"
        width={1586}
        height={992}
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />
    </div>
  )
}
