import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { SignValidatorDto, SignValidatorSchema } from './dto/sign-validator.dto.js';

@ApiTags('validators')
@Controller('validators')
export class ValidatorsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'List registered validators.' })
  async list() {
    return this.adminService.listValidators();
  }

  @Post('sign')
  @ApiOperation({ summary: 'Simulate signing with the admin validator key.' })
  async sign(@Body() dto: SignValidatorDto) {
    const payload = SignValidatorSchema.parse(dto);
    return this.adminService.sign(payload);
  }
}
