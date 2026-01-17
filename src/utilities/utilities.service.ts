import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

@Injectable()
export class UtilitiesService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // INTERESTS
  // ============================================

  async getInterests() {
    const interests = await (this.prisma as any).interest.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        order: true,
      },
    });

    return {
      message: 'Interests retrieved successfully',
      data: interests,
    };
  }

  async addInterest(name: string, order?: number) {
    // Check if interest already exists
    const existing = await (this.prisma as any).interest.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException('Interest with this name already exists');
    }

    const interest = await (this.prisma as any).interest.create({
      data: {
        name,
        order: order ?? 0,
      },
    });

    return {
      message: 'Interest added successfully',
      data: interest,
    };
  }

  async removeInterest(id: string) {
    const interest = await (this.prisma as any).interest.findUnique({
      where: { id },
    });

    if (!interest) {
      throw new NotFoundException('Interest not found');
    }

    // Soft delete by setting isActive to false
    await (this.prisma as any).interest.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      message: 'Interest removed successfully',
    };
  }

  // ============================================
  // AGE GROUPS
  // ============================================

  async getAgeGroups() {
    const ageGroups = await (this.prisma as any).ageGroup.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        label: true,
        minAge: true,
        maxAge: true,
        order: true,
      },
    });

    return {
      message: 'Age groups retrieved successfully',
      data: ageGroups,
    };
  }

  async addAgeGroup(label: string, minAge?: number, maxAge?: number, order?: number) {
    // Check if age group already exists
    const existing = await (this.prisma as any).ageGroup.findUnique({
      where: { label },
    });

    if (existing) {
      throw new ConflictException('Age group with this label already exists');
    }

    const ageGroup = await (this.prisma as any).ageGroup.create({
      data: {
        label,
        minAge,
        maxAge,
        order: order ?? 0,
      },
    });

    return {
      message: 'Age group added successfully',
      data: ageGroup,
    };
  }

  async removeAgeGroup(id: string) {
    const ageGroup = await (this.prisma as any).ageGroup.findUnique({
      where: { id },
    });

    if (!ageGroup) {
      throw new NotFoundException('Age group not found');
    }

    await (this.prisma as any).ageGroup.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      message: 'Age group removed successfully',
    };
  }

  // ============================================
  // GENDERS
  // ============================================

  async getGenders() {
    const genders = await (this.prisma as any).gender.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        label: true,
        order: true,
      },
    });

    return {
      message: 'Genders retrieved successfully',
      data: genders,
    };
  }

  async addGender(label: string, order?: number) {
    // Check if gender already exists
    const existing = await (this.prisma as any).gender.findUnique({
      where: { label },
    });

    if (existing) {
      throw new ConflictException('Gender with this label already exists');
    }

    const gender = await (this.prisma as any).gender.create({
      data: {
        label,
        order: order ?? 0,
      },
    });

    return {
      message: 'Gender added successfully',
      data: gender,
    };
  }

  async removeGender(id: string) {
    const gender = await (this.prisma as any).gender.findUnique({
      where: { id },
    });

    if (!gender) {
      throw new NotFoundException('Gender not found');
    }

    await (this.prisma as any).gender.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      message: 'Gender removed successfully',
    };
  }

  // ============================================
  // CATEGORIES
  // ============================================

  async getCategories() {
    const categories = await (this.prisma as any).category.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        order: true,
      },
    });

    return {
      message: 'Categories retrieved successfully',
      data: categories,
    };
  }

  async addCategory(title: string, subtitle?: string, order?: number) {
    const category = await (this.prisma as any).category.create({
      data: {
        title,
        subtitle,
        order: order ?? 0,
      },
    });

    return {
      message: 'Category added successfully',
      data: category,
    };
  }

  async removeCategory(id: string) {
    const category = await (this.prisma as any).category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await (this.prisma as any).category.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      message: 'Category removed successfully',
    };
  }

  // ============================================
  // PLATFORMS
  // ============================================

  async getPlatforms() {
    const platforms = await (this.prisma as any).platform.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        icon: true,
        order: true,
      },
    });

    return {
      message: 'Platforms retrieved successfully',
      data: platforms,
    };
  }

  async addPlatform(name: string, icon?: string, order?: number) {
    // Check if platform already exists
    const existing = await (this.prisma as any).platform.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException('Platform with this name already exists');
    }

    const platform = await (this.prisma as any).platform.create({
      data: {
        name,
        icon,
        order: order ?? 0,
      },
    });

    return {
      message: 'Platform added successfully',
      data: platform,
    };
  }

  async removePlatform(id: string) {
    const platform = await (this.prisma as any).platform.findUnique({
      where: { id },
    });

    if (!platform) {
      throw new NotFoundException('Platform not found');
    }

    await (this.prisma as any).platform.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      message: 'Platform removed successfully',
    };
  }
}

