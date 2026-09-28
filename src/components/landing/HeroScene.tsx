import voxelScene from '@/assets/hero/voxel-scene.webp'
import voxelScene640 from '@/assets/hero/voxel-scene-640.webp'
import voxelScene960 from '@/assets/hero/voxel-scene-960.webp'

export function HeroScene() {
  return (
    <div className="arena-scene">
      <div className="arena-scene__grid" aria-hidden="true" />
      <img
        className="arena-scene__image"
        src={voxelScene}
        srcSet={`${voxelScene640} 640w, ${voxelScene960} 960w, ${voxelScene} 1586w`}
        sizes="(max-width: 768px) 100vw, 55vw"
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
