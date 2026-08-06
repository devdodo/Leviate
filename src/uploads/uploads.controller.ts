import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { BaseResponseDto } from '../common/dto/base-response.dto';

const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

// Multer's own ceiling for the generic endpoint. The service enforces the real
// (configurable) limit; this only stops us buffering something absurd in memory.
const fileUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(uploadInterceptor)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, GIF, WebP, AVIF)',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload an image to Cloudinary',
    description:
      'Public endpoint (no login required). Optional Bearer token: when sent, files are stored under your user folder; anonymous uploads go under `anonymous`. Returns HTTPS `secureUrl` for use across the platform.',
  })
  @ApiResponse({
    status: 201,
    description: 'Uploaded successfully',
    type: BaseResponseDto,
  })
  async uploadImage(
    @CurrentUser() user: { id?: string } | null,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Missing file field `file` (multipart/form-data)',
      );
    }

    const maxBytes = this.uploadsService.maxImageBytes();
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))} MB`,
      );
    }

    const folderKey = user?.id ?? 'anonymous';
    const payload = await this.uploadsService.uploadImageToCloudinary(
      file,
      folderKey,
    );

    return {
      message: 'Image uploaded successfully',
      data: {
        url: payload.secureUrl,
        secureUrl: payload.secureUrl,
        publicId: payload.publicId,
        width: payload.width,
        height: payload.height,
        format: payload.format,
        bytes: payload.bytes,
      },
    };
  }

  @Post('file')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(fileUploadInterceptor)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'File to upload (JPEG, PNG, GIF, WebP, AVIF, HEIC, PDF, MP4, WebM, MOV)',
        },
        folder: {
          type: 'string',
          description:
            'Optional subfolder inside your user folder, e.g. "submissions"',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload a file to ImageKit',
    description:
      'Requires authentication. Files are stored under `<IMAGEKIT_UPLOAD_FOLDER>/<userId>[/<folder>]` with a unique ' +
      'generated name, so uploads never overwrite each other. Returns the CDN `url` plus the `fileId` needed to delete it later.',
  })
  @ApiResponse({
    status: 201,
    description: 'Uploaded successfully',
    type: BaseResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing file, unsupported type, or file too large',
  })
  @ApiResponse({
    status: 503,
    description: 'ImageKit is not configured or is unreachable',
  })
  async uploadFile(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Missing file field `file` (multipart/form-data)',
      );
    }

    const result = await this.uploadsService.uploadFileToImageKit(
      file,
      user.id,
      body.folder,
    );

    return {
      message: 'File uploaded successfully',
      data: result,
    };
  }
}
