import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserOrmEntity } from '../../../../shared/infrastructure/persistence/orm/user.orm-entity';
import {
  ExperienceItem,
  normalizePrivacySettings,
  parseSkills,
  Perfil,
  PerfilDatos,
  PerfilPortafolio,
  PerfilRepository,
  PrivacySettings,
} from '../../domain/perfil';

export function toPerfil(u: UserOrmEntity): Perfil {
  const experience = Array.isArray(u.experience) ? (u.experience as ExperienceItem[]) : [];
  return Perfil.create({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    firstName: u.first_name ?? '',
    lastName: u.last_name ?? '',
    phoneNumber: u.phone_number,
    designation: u.designation,
    description: u.description,
    profileImage: u.profile_image,
    coverImage: u.cover_image,
    city: u.city,
    country: u.country,
    zipCode: u.zip_code,
    website: u.website,
    skills: parseSkills(u.skills),
    joiningDate: u.joining_date,
    githubUsername: u.github_username,
    dribbbleUsername: u.dribbble_username,
    pinterestUsername: u.pinterest_username,
    privacySettings: normalizePrivacySettings(u.privacy_settings ?? {}),
    experience,
  });
}

@Injectable()
export class TypeOrmPerfilRepository extends PerfilRepository {
  constructor(@InjectRepository(UserOrmEntity) private readonly users: Repository<UserOrmEntity>) {
    super();
  }

  async findById(userId: number): Promise<Perfil | null> {
    const u = await this.users.findOne({ where: { id: userId } });
    return u ? toPerfil(u) : null;
  }

  async findPasswordHash(userId: number): Promise<string | null> {
    const u = await this.users.findOne({ where: { id: userId }, select: { id: true, password: true } });
    return u?.password ?? null;
  }

  async updateDatos(userId: number, d: PerfilDatos): Promise<void> {
    await this.users.update(
      { id: userId },
      {
        first_name: d.firstName,
        last_name: d.lastName,
        email: d.email,
        phone_number: d.phoneNumber,
        designation: d.designation,
        website: d.website,
        city: d.city,
        country: d.country,
        zip_code: d.zipCode,
        description: d.description,
        skills: d.skills.length ? d.skills.join(',') : null,
        joining_date: d.joiningDate,
        updated_at: new Date(),
      },
    );
  }

  async updatePortafolio(userId: number, p: PerfilPortafolio): Promise<void> {
    await this.users.update(
      { id: userId },
      {
        github_username: p.githubUsername,
        website: p.website,
        dribbble_username: p.dribbbleUsername,
        pinterest_username: p.pinterestUsername,
        updated_at: new Date(),
      },
    );
  }

  async updateImage(userId: number, kind: 'profile' | 'cover', relativePath: string): Promise<void> {
    await this.users.update(
      { id: userId },
      kind === 'profile' ? { profile_image: relativePath } : { cover_image: relativePath },
    );
  }

  async updatePassword(userId: number, hash: string): Promise<void> {
    await this.users.update({ id: userId }, { password: hash, updated_at: new Date() });
  }

  async updatePrivacySettings(userId: number, settings: PrivacySettings): Promise<void> {
    await this.users.update({ id: userId }, { privacy_settings: settings });
  }

  async updateExperience(userId: number, experience: ExperienceItem[]): Promise<void> {
    await this.users.update({ id: userId }, { experience });
  }
}
