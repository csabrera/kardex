import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  oldPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @ApiProperty()
  @IsString()
  confirmPassword!: string;
}
