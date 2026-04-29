import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiPropertyOptional({ description: 'Se auto-genera si no se proporciona' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
