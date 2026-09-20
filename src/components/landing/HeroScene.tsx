import voxelScene from '@/assets/hero/voxel-scene.png'

export function HeroScene() {
  return (
    <div className="arena-scene" aria-label="Интерфейс тренировочного поединка">
      <div className="arena-scene__grid" aria-hidden="true" />
      <img className="arena-scene__image" src={voxelScene} alt="Два участника ведут переговоры за столом" />
    </div>
  )
}
