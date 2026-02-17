import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tags')
@UseGuards(JwtAuthGuard) // Protege todas las rutas con JWT
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  create(@Body() createTagDto: CreateTagDto, @Request() req) {
    // Asignar automáticamente la compañía del usuario autenticado
    const companyId = req.user.companyId || createTagDto.company_id;
    return this.tagsService.create({ ...createTagDto, company_id: companyId });
  }

  @Get()
  findAll(@Request() req) {
    const companyId = req.user.companyId;
    return this.tagsService.findAllByCompany(companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const companyId = req.user.companyId;
    return this.tagsService.findOne(id, companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
    @Request() req,
  ) {
    const companyId = req.user.companyId;
    return this.tagsService.update(id, updateTagDto, companyId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const companyId = req.user.companyId;
    return this.tagsService.remove(id, companyId);
  }

  // Endpoint para buscar etiquetas por IDs
  @Post('by-ids')
  findByIds(@Body() body: { ids: string[] }, @Request() req) {
    const companyId = req.user.companyId;
    return this.tagsService.findByIds(body.ids, companyId);
  }
  // src/modules/tags/tags.controller.ts - AÑADIR nuevo endpoint
  @Get(':id/contacts')
  getTagContacts(@Param('id') id: string, @Request() req) {
    const companyId = req.user.companyId;
    return this.tagsService.findTagWithContacts(id, companyId);
  }
}
