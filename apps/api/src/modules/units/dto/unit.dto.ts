import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUnitDto {
  @ApiPropertyOptional({ description: 'Se auto-genera si no se proporciona' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  code?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(10)
  abbreviation: string;
}

export class UpdateUnitDto extends PartialType(CreateUnitDto) {}
