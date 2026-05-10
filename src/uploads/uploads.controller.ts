import {
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
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { BaseResponseDto } from '../common/dto/base-response.dto';

const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
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
}
