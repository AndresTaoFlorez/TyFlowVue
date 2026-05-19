import client from '@/infrastructure/http/client'
import { Role } from '@/domain/entities/Role'

export const RoleRepository = {
  async fetchAll() {
    const { data } = await client.get('/roles')
    return data.map((item) => new Role(item))
  },

  async fetchById(roleId) {
    const { data } = await client.get(`/roles/${roleId}`)
    return new Role(data)
  },
}
